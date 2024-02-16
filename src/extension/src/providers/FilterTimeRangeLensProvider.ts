/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { CancellationToken, CodeLens, CodeLensProvider, Command, EventEmitter, Range, TextDocument } from "vscode";

import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { throwIfCancellation } from "../utils/throwIfCancellation";

import { LogContentProvider } from "./LogContentProvider";
import { FilterChangedEvent } from "@t200logs/common";

export type DateRange = [Date | null, Date | null];

/**
 * FilterTimeRangeLensProvider is a class that provides the ability to decorate in the logs viewer.
 * This class is responsible for providing the code lenses that allow the user to filter by time range.
 */
export class FilterTimeRangeLensProvider implements CodeLensProvider {
    public static readonly commandId = "t200logs.inlineDateFilter";

    public static readonly dateRangeTimeInMilliSeconds = 5000;

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
    provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] {
        let lenses = [];
        const regex = /\/\/ \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
        const timeRangeInSec = FilterTimeRangeLensProvider.dateRangeTimeInMilliSeconds / 1000;
        this.logger.info("provideCodeLenses.start", undefined, { documentLineCount: "" + document.lineCount });
        for (let i = 0; i < document.lineCount; i++) {
            let line = document.lineAt(i);
            if (line.text.match(regex)) {
                const filterDateRange = FilterTimeRangeLensProvider.getDateRange(line.text);
                const range = new Range(i, 0, i, 0);
                const filterCommand: Command = {
                    title: `🔍 Filter ${this.getCodeLensDateRangeTitle(filterDateRange)}`,
                    command: FilterTimeRangeLensProvider.commandId,
                    tooltip: `Filter by this date +- ${timeRangeInSec} seconds`,
                    arguments: [filterDateRange],
                };
                const resetFilterCommand: Command = {
                    title: "❌ Reset filter",
                    command: FilterTimeRangeLensProvider.commandId,
                    tooltip: "Reset the filter",
                    arguments: [[null, null]],
                };
                lenses.push(new CodeLens(range, filterCommand));
                lenses.push(new CodeLens(range, resetFilterCommand));
                throwIfCancellation(token);
            }
        }
        this.logger.info("provideCodeLenses.end", undefined, {
            documentLineCount: "" + document.lineCount,
            createdLenses: "" + lenses.length,
        });
        return lenses;
    }

    /**
     * Executes the command represented by this code lens.
     * @param dateRange Tuple containing the from and till dates.
     * @param event The event to fire when the filter is changed.
     */
    public static executeCommand(dateRange: DateRange, event: EventEmitter<FilterChangedEvent>) {
        // const date = new Date(dateLine.replace(LogContentProvider.foldingRegionPrefix, ""));
        // const fromDate = new Date(date.getTime() - 5000);
        // const tillDate = new Date(date.getTime() + 5000);
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


