/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/* eslint-disable max-classes-per-file */


import { FilterChangedEvent } from "@t200logs/common";
import { CancellationToken, CodeLens, CodeLensProvider, Command, EventEmitter, ProviderResult, Range, TextDocument } from "vscode";

import { EXTENSION_ID } from "../constants/constants";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { throwIfCancellation } from "../utils/throwIfCancellation";

import { LogContentProvider } from "./LogContentProvider";

export type DateRange = [Date | null, Date | null];

/**
 * A CodeLens with a date range.
 */
class CodeLensWithDateRange extends CodeLens {
    public readonly dateRange: [Date, Date];
    public readonly lensType: "filter" | "resetFilter";

    /**
     * Initializes a new instance of the CodeLensWithDateRange class.
     * @param range The range of the code lens.
     * @param dateRange The date range of the code lens. E.g. [fromDate, tillDate].
     * @param lensType The type of the code lens. E.g. "filter" or "resetFilter".
     */
    constructor(range: Range, dateRange: [Date, Date], lensType: "filter" | "resetFilter") {
        super(range, undefined);
        this.dateRange = dateRange;
        this.lensType = lensType;
    }
}

/**
 * FilterTimeRangeLensProvider is a class that provides the ability to decorate in the logs viewer.
 * This class is responsible for providing the code lenses that allow the user to filter by time range.
 */
export class FilterTimeRangeLensProvider implements CodeLensProvider<CodeLensWithDateRange> {
    /**
     * The id of the command that is executed by clicking on the code lens.
     */
    public static readonly commandId = `${EXTENSION_ID}.inlineDateFilter`;

    /**
     * The time range in milliseconds that the filter will be applied to.
     */
    public static readonly dateRangeTimeInMilliSeconds = 5000;

    /**
     * The time range in seconds based on {@link dateRangeTimeInMilliSeconds}.
     */
    private static readonly timeRangeInSeconds = FilterTimeRangeLensProvider.dateRangeTimeInMilliSeconds / 1000;

    private readonly logger: ScopedILogger;

    /**
     * Initializes a new instance of the FilterTimeRangeLensProvider class.
     * @param logger The logger.
     */
    constructor(logger: ITelemetryLogger) {
        this.logger = logger.createLoggerScope("FilterTimeRangeLensProvider");
    }

    /**
     * Compute a list of {@link CodeLens lenses}. This call should return as fast as possible and if
     * computing the commands is expensive implementors should only return code lens objects with the
     * range set and implement {@link resolveCodeLens resolve}.
     *
     * @param document The document in which the command was invoked.
     * @param token A cancellation token.
     * @returns An array of code lenses or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    async provideCodeLenses(document: TextDocument, token: CancellationToken): Promise<CodeLensWithDateRange[]> {
        const regex = /\/\/ \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
        this.logger.info("provideCodeLenses.start", undefined, { documentLineCount: "" + document.lineCount });

        return new Promise<CodeLensWithDateRange[]>(resolve => {
            let lenses = [];

            // Loop through the regex matches and create a code lens for each match.
            let match;
            while ((match = regex.exec(document.getText())) !== null) {
                const filterDateRange = FilterTimeRangeLensProvider.getDateRange(match[0]);
                const range = new Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length));
                lenses.push(new CodeLensWithDateRange(range, filterDateRange, "filter"));
                lenses.push(new CodeLensWithDateRange(range, filterDateRange, "resetFilter"));
                throwIfCancellation(token);
            }
            this.logger.info("provideCodeLenses.end", undefined, {
                documentLineCount: "" + document.lineCount,
                createdLenses: "" + lenses.length,
            });
            resolve(lenses);
        });
    }

    /**
     * Resolve a code lens by adding the command based on the given date range.
     * @param codeLens Resolves a code lens by adding the missing command.
     * @param token CancellationToken.
     * @returns The code lens with the missing command.
     */
    public resolveCodeLens(codeLens: CodeLensWithDateRange, token: CancellationToken): ProviderResult<CodeLensWithDateRange> {
        throwIfCancellation(token);
        let command: Command;
        if (codeLens.lensType === "filter") {
            command = {
                title: `🔍 Filter ${this.getCodeLensDateRangeTitle(codeLens.dateRange)}`,
                command: FilterTimeRangeLensProvider.commandId,
                tooltip: `Filter by this date +- ${FilterTimeRangeLensProvider.timeRangeInSeconds} seconds`,
                arguments: [codeLens.dateRange],
            };
        } else {
            command = RESET_FILTER_COMMAND;
        }
        codeLens.command = command;
        return codeLens;
    }

    /**
     * Executes the command represented by this code lens.
     * @param dateRange Tuple containing the from and till dates.
     * @param event The event to fire when the filter is changed.
     */
    public static executeCommand(dateRange: DateRange, event: EventEmitter<FilterChangedEvent>) {
        const [fromDate, tillDate] = dateRange;

        console.log("filter from", fromDate, "to", tillDate);
        const fromDateStr = fromDate ? fromDate.toISOString() : "";
        const tillDateStr = tillDate ? tillDate.toISOString() : "";
        event.fire({
            fromDate: fromDateStr,
            tillDate: tillDateStr,
        });
    }

    /**
     * Gets the date range from the given date line.
     * @param dateLine The line containing the date to filter by. E.g. "// 2019-01-01T00:00:00.000Z".
     * @returns The date range.
     */
    private static getDateRange(dateLine: string): [Date, Date] {
        const rawDateString = dateLine.replace(LogContentProvider.foldingRegionPrefix, "");
        const date = new Date(rawDateString);
        const fromDate = new Date(date.getTime() - FilterTimeRangeLensProvider.dateRangeTimeInMilliSeconds);
        const tillDate = new Date(date.getTime() + FilterTimeRangeLensProvider.dateRangeTimeInMilliSeconds);
        return [fromDate, tillDate];
    }

    /**
     * Gets the title of the code lens for the given date line.
     * @param dateRange Tuple containing the from and till dates.
     * @returns The title of the code lens. E.g. "00:00:00 - 00:00:05".
     */
    private getCodeLensDateRangeTitle(dateRange: [Date, Date]) {
        const [fromDate, tillDate] = dateRange;
        return `${FilterTimeRangeLensProvider.getTimeFromDate(fromDate)} - ${FilterTimeRangeLensProvider.getTimeFromDate(tillDate)}`;
    }

    /**
     * Gets the time from the given date. E.g. "00:00:00".
     * @param date The date to get the time from.
     * @returns The time from the given date.
     */
    private static getTimeFromDate(date: Date) {
        return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    }
}

const RESET_FILTER_COMMAND: Command = {
    title: "❌ Reset filter",
    command: FilterTimeRangeLensProvider.commandId,
    tooltip: "Reset the filter",
    arguments: [[null, null]],

};