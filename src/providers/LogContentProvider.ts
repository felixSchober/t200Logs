/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as fs from "fs/promises";

import * as vscode from "vscode";

import { ERROR_REGEX, GUID_REGEX, WARN_REGEX, WEB_DATE_REGEX } from "../constants/regex";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { throwIfCancellation } from "../utils/throwIfCancellation";

export type LogLevel = "info" | "debug" | "warning" | "error";
/**
 * The event that is fired when the filter changes.
 */
export type FilterChangedEvent = {
    /**
     * The time filter.
     */
    fromDate?: string;

    /**
     * The time filter.
     */
    tillDate?: string;

    /**
     * When true, removes all entries that do not have an event time.
     */
    removeEntriesWithNoEventTime?: boolean;

    /**
     * Adds a keyword to the filter.
     */
    addKeywordFilter?: string;

    /**
     * Removes a keyword from the filter.
     */
    removeKeywordFilter?: string;

    /**
     * Adds a log level.
     */
    addLogLevel?: LogLevel;

    /**
     * Removes a log level.
     */
    removeLogLevel?: LogLevel;

    /**
     * If not `undefined` we will try to set a session id filter.
     */
    setSessionIdFilter?: string;

    /**
     * If not `undefined` we will try to remove a session id filter.
     */
    removeSessionIdFilter?: string;
};

/**
 * The event that is fired when the filter changes.
 */
export type TimeFilterChangedEvent = Pick<FilterChangedEvent, "fromDate" | "tillDate">;

export type DisplaySettingsChangedEvent = {
    /**
     * Whether to display the file names. A null value means that the user did not change the setting.
     */
    displayFileNames: boolean | null;

    /**
     * Whether to display the dates in line. A null value means that the user did not change the setting.
     */
    displayDatesInLine: boolean | null;

    /**
     * Whether to display the guids. A null value means that the user did not change the setting.
     */
    displayGuids: boolean | null;
};

export type FilterKeywordChangedEvent = {
    /**
     * The id of the checkbox.
     */
    checkboxId: string;
    /**
     * The keyword filter.
     */
    keyword: string;
    /**
     * The state of the checkbox.
     */
    isChecked: boolean;
};

type LogEntry = {
    /**
     * The date of the log entry.
     */
    date: Date;
    /**
     * The text of the log entry.
     */
    text: string;

    /**
     * The service that generated the log entry.
     */
    service?: string;

    /**
     * Whether the log entry is a marker entry for grouping.
     */
    isMarker?: boolean;
};

type ServiceFiles = {
    /**
     * The name of the service.
     */
    serviceName: string;
    /**
     * The files of the service.
     */
    files: vscode.Uri[];
};

const MAX_LOG_FILES_PER_SERVICE = 3;

const MAX_LOG_FILES_RETURNED = 400;

const LOG_LEVEL_REGEX: Record<LogLevel, RegExp> = {
    error: ERROR_REGEX,
    debug: /<DBG>|Ver/,
    warning: WARN_REGEX,
    info: /(<INFO>)|Inf/,
};

/**
 * The date of the epoch. Used for filtering out log entries that do not have a timestamp.
 */
const EPOCH_DATE = new Date(0);

/**
 * A content provider that transforms the content of a log file.
 */
export class LogContentProvider implements vscode.TextDocumentContentProvider {
    /**
     * Filter out log entries that are before this date.
     * This field is the string representation of a date.
     */
    private _timeFilterFrom: string | null = null;

    /**
     * Sets both {@link _timeFilterFrom} and {@link timeFilterFromDate}.
     */
    private set timeFilterFrom(value: string | null) {
        this._timeFilterFrom = value;
        if (this._timeFilterFrom && !isNaN(Date.parse(this._timeFilterFrom))) {
            this.timeFilterFromDate = new Date(this._timeFilterFrom);
        } else {
            this.timeFilterFromDate = null;
        }
        this.onTimeFilterChangeEvent.fire({ fromDate: value ?? undefined });
    }

    /**
     * Date representation of {@link _timeFilterFrom}.
     */
    private timeFilterFromDate: Date | null = null;

    /**
     * The minimum date that can be used as a filter except if the user wants to display all entries.
     */
    private minimumDate: string | null = new Date(1000).toISOString();

    /**
     * Filter out log entries that are after this date.
     * This field is the string representation of a date.
     */
    private _timeFilterTill: string | null = null;

    /**
     * Sets both {@link _timeFilterTill} and {@link timeFilterTillDate}.
     */
    private set timeFilterTill(value: string | null) {
        this._timeFilterTill = value;
        if (this._timeFilterTill && !isNaN(Date.parse(this._timeFilterTill))) {
            this.timeFilterTillDate = new Date(this._timeFilterTill);
        } else {
            this.timeFilterTillDate = null;
        }
        this.onTimeFilterChangeEvent.fire({ tillDate: value ?? undefined });
    }

    /**
     * Date representation of {@link _timeFilterTill}.
     */
    private timeFilterTillDate: Date | null = null;

    /**
     * Filter out log entries that do not contain either of these keywords.
     */
    private keywordFilters: string[] = [];

    /**
     * The session id marks the starting point of the log entries to filter to.
     */
    private sessionId: string | null = null;

    /**
     * The currently disabled log levels.
     */
    private disabledLogLevels: LogLevel[] = [];

    /**
     * A list of log files that are used to render the text content.
     * This list will only be set on the first call to provideTextDocumentContent.
     */
    private logFileCache: vscode.Uri[] = [];

    /**
     * A list of lines from the log files generated at the start when the class is initialized.
     */
    private logEntryCache: LogEntry[] = [];

    /**
     * A map of log entries grouped by timestamp seconds.
     */
    private groupedLogEntries: Map<number, LogEntry[]> = new Map();

    /**
     * The number of characters in the longest file name.
     */
    private lengthOfLongestFileName = 0;

    public static readonly documentScheme = "log-viewer";

    public static readonly foldingRegionEndMarker = "======";

    /**
     * The prefix for the folding region markers. E.g. // ====== or // 2023-11-28T15:16:31.758465+00:00.
     */
    public static readonly foldingRegionPrefix = "// ";

    public static readonly documentUri = vscode.Uri.parse(`${this.documentScheme}:/log-viewer.log`);

    private readonly logger: ScopedILogger;

    /**
     * Strings to remove from the log entries.
     */
    private stringsToRemove = [
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(\+|-)\d{2}:\d{2}/, // 2023-11-28T15:16:31.758465+00:00
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, // 2023-11-29T10:21:49.895Z
        /\w{3} \w{3} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT(\+|-)\d{4} \(\D*\)/, // Sun Jan 07 2024 18:45:43 GMT-0800 (Pacific Standard Time)
        /\s0x[0-9a-f]{8}/, //  0x00001f68 (ProcessIds) with two spaces before
        /-logs\.txt/,
        /<\d{5}>/,
        /\s0x[0-9a-fA-F]{16}\s/g, // 0x0000000000000000 with spaces before and after
    ];

    private readonly stringReplacementMap = [
        {
            searchString: "AuthenticationService: [Auth]",
            replacementString: "[Auth]",
        },
        {
            searchString: "CDLWorkerCacheManager: [CDLWorkerCacheManager]",
            replacementString: "[CDLWorkerCacheManager]",
        },
    ];

    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    private changeTrigger = 0;

    private _displayFileNames = true;

    /**
     * Whether to display the dates in line.
     */
    private _displayDatesInLine = false;

    /**
     * Event that is fired when the time filters change.
     * Other classes can subscribe to this event to get notified when the time filters change.
     */
    public onTimeFilterChangeEvent = new vscode.EventEmitter<TimeFilterChangedEvent>();

    /**
     * Event that is fired when the text document generation is finished.
     */
    public onTextDocumentGenerationFinished = new vscode.EventEmitter<string>();

    /**
     * Creates a new instance of the LogContentProvider class.
     * @param onFilterChangeEvent The event that is fired when the filter changes.
     * @param onDisplaySettingsChangedEvent The event that is fired when the display settings change.
     * @param logger The logger.
     */
    constructor(
        onFilterChangeEvent: vscode.Event<FilterChangedEvent>,
        onDisplaySettingsChangedEvent: vscode.Event<DisplaySettingsChangedEvent>,
        logger: ITelemetryLogger
    ) {
        onFilterChangeEvent(filterChangeEvent => {
            this.updateFilters(filterChangeEvent);
        });

        onDisplaySettingsChangedEvent(displaySettingsChangedEvent => {
            this.changeTrigger++;

            if (displaySettingsChangedEvent.displayFileNames !== null) {
                this._displayFileNames = displaySettingsChangedEvent.displayFileNames;
            }

            if (displaySettingsChangedEvent.displayGuids !== null) {
                // if the user wants to display the guids, remove the regex that removes them
                if (displaySettingsChangedEvent.displayGuids) {
                    this.stringsToRemove = this.stringsToRemove.filter(regex => regex.source !== GUID_REGEX.source);
                } else {
                    this.stringsToRemove.push(GUID_REGEX);
                }
            }

            if (displaySettingsChangedEvent.displayDatesInLine !== null) {
                this._displayDatesInLine = displaySettingsChangedEvent.displayDatesInLine;
            }

            this._onDidChange.fire(LogContentProvider.documentUri);
        });

        // set the "timeFilterFrom" to a second after timestamp 0.
        // This is done so that we ignore all events that do not have a timestamp.
        this.timeFilterFrom = this.minimumDate;
        this.logger = logger.createLoggerScope("LogContentProvider");
    }

    /**
     * Resets the cache and filters causing the content provider to re-fetch the log files and re-generate the content.
     */
    public reset() {
        this.logger.info("reset");
        this.logFileCache = [];
        this.logEntryCache = [];
        this.groupedLogEntries = new Map();
        this.keywordFilters = [];
        this.disabledLogLevels = [];
        this.sessionId = null;
        this.timeFilterFrom = this.minimumDate;
        this.timeFilterTill = null;
        this.changeTrigger++;
        this._onDidChange.fire(LogContentProvider.documentUri);
    }

    /**
     * Updates the filters for the log entries.
     * @param filterChangeEvent The event that is fired when the filter changes.
     */
    private updateFilters(filterChangeEvent: FilterChangedEvent) {
        if (filterChangeEvent.addKeywordFilter) {
            this.keywordFilters.push(filterChangeEvent.addKeywordFilter);
        }

        if (filterChangeEvent.removeKeywordFilter) {
            this.keywordFilters = this.keywordFilters.filter(keyword => keyword !== filterChangeEvent.removeKeywordFilter);
        }

        if (filterChangeEvent.addLogLevel) {
            this.disabledLogLevels = this.disabledLogLevels.filter(level => level !== filterChangeEvent.addLogLevel);
        }

        if (filterChangeEvent.removeLogLevel) {
            if (!this.disabledLogLevels.includes(filterChangeEvent.removeLogLevel)) {
                this.disabledLogLevels.push(filterChangeEvent.removeLogLevel);
            }
        }

        if (filterChangeEvent.fromDate || filterChangeEvent.fromDate === "") {
            if (filterChangeEvent.fromDate === "") {
                this.timeFilterFrom = this.minimumDate;
            } else {
                this.timeFilterFrom = filterChangeEvent.fromDate;
            }
        }

        if (filterChangeEvent.tillDate || filterChangeEvent.tillDate === "") {
            this.timeFilterTill = filterChangeEvent.tillDate;
        }

        if (filterChangeEvent.removeEntriesWithNoEventTime === true) {
            this.minimumDate = new Date(1000).toISOString();
            this.timeFilterFrom = this.minimumDate;
        } else if (filterChangeEvent.removeEntriesWithNoEventTime === false) {
            this.timeFilterFrom = null;
            this.minimumDate = null;
        }

        if (filterChangeEvent.setSessionIdFilter) {
            this.sessionId = filterChangeEvent.setSessionIdFilter;
            const sessionIdLogEntry = this.findEarliestSessionIdInLogEntries();
            if (sessionIdLogEntry) {
                // subtract 1 second from the timestamp to make sure we include the log entry with the session id
                const filterFrom = new Date(sessionIdLogEntry.date.getTime() - 1000).toISOString();
                this.logger.info("updateFilters.setSessionIdFilter.success", undefined, { sessionId: this.sessionId, filterFrom });
                this.timeFilterFrom = filterFrom;
            } else {
                this.logger.logException(
                    "updateFilters.setSessionIdFilter.notFound",
                    new Error(`Could not find log entry with session id: ${this.sessionId}`),
                    undefined,
                    {
                        sessionId: this.sessionId,
                    },
                    true,
                    "Session Id"
                );
            }
        }

        if (filterChangeEvent.removeSessionIdFilter) {
            this.sessionId = null;
            this.timeFilterFrom = this.minimumDate;
        }

        this.changeTrigger++;
        this._onDidChange.fire(LogContentProvider.documentUri);
    }

    /**
     * Tries to find a log entry that contains the session id and returns the entry.
     * There might be multiple log entries with the same session id, but we need to find the earliest one.
     * @returns The first log entry that contains the session id.
     */
    private findEarliestSessionIdInLogEntries(): LogEntry | null {
        if (!this.sessionId) {
            return null;
        }

        let foundEntry: LogEntry | null = null;
        for (const logEntry of this.logEntryCache) {
            if (logEntry.text.includes(this.sessionId)) {
                // make sure it's not the summary.txt file
                if (logEntry.service === "summary") {
                    this.logger.info("findEarliestSessionIdInLogEntries.foundInSummary", undefined, { sessionId: this.sessionId });
                    continue;
                }

                // make sure the entry has a timestamp (not the epoch date)
                if (logEntry.date.getTime() === EPOCH_DATE.getTime()) {
                    this.logger.info(
                        "findEarliestSessionIdInLogEntries.noDate",
                        `Found log entry with session id: ${logEntry.text} but it has no timestamp.`,
                        { sessionId: this.sessionId }
                    );
                    continue;
                }

                if (!foundEntry) {
                    this.logger.info("findEarliestSessionIdInLogEntries.foundFirst", undefined, {
                        sessionId: this.sessionId,
                        service: logEntry.service,
                    });
                    foundEntry = logEntry;
                } else {
                    // if we found another log entry with the same session id, check if it's earlier
                    if (logEntry.date.getTime() < foundEntry.date.getTime()) {
                        this.logger.info("findEarliestSessionIdInLogEntries.foundEarlier", undefined, {
                            sessionId: this.sessionId,
                            service: logEntry.service,
                        });
                        foundEntry = logEntry;
                    } else {
                        this.logger.info("findEarliestSessionIdInLogEntries.foundLater", undefined, {
                            sessionId: this.sessionId,
                            service: logEntry.service,
                        });
                    }
                }
            }
        }

        return foundEntry;
    }

    /**
     * Calculates the number of filters that are currently active.
     * @returns The number of filters that are currently active.
     */
    public getNumberOfActiveFilters(): number {
        const numberOfKeywordFilters = this.keywordFilters.length;
        const numberOfTimeFilters = (this._timeFilterFrom ? 1 : 0) + (this._timeFilterTill ? 1 : 0);
        const logLevelFilter = this.disabledLogLevels.length;

        return numberOfKeywordFilters + numberOfTimeFilters + logLevelFilter;
    }

    /**
     * Provide textual content for a given uri.
     * @param _ An uri which scheme matches the scheme this provider was created for.
     * @returns A string representing the textual content.
     */
    public async provideTextDocumentContent(_: vscode.Uri): Promise<string> {
        if (!vscode.workspace.workspaceFolders) {
            this.logger.logException(
                "provideTextDocumentContent.noWorkspaceFolder",
                new Error("No workspace folder found."),
                "No workspace folder found. Please open the folder containing the Teams Logs and try again.",
                undefined,
                true,
                "No workspace folder"
            );
            return "";
        }

        // show async progress
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                cancellable: true,
                title: "Generating log content",
            },
            async (progress, token) => {
                this.logger.info("provideTextDocumentContent.start", undefined, { changeTrigger: "" + this.changeTrigger });

                token.onCancellationRequested(() => {
                    this.logger.info("provideTextDocumentContent.cancelled", undefined);
                });

                progress.report({ increment: 1 });
                if (this.logEntryCache.length === 0) {
                    this.logFileCache = await vscode.workspace.findFiles(
                        "**/*.{log,txt}",
                        "**/node_modules/**",
                        MAX_LOG_FILES_RETURNED,
                        token
                    );
                    this.logger.info("provideTextDocumentContent.findFiles", undefined, { logFileCount: "" + this.logFileCache.length });
                } else {
                    this.logger.info("provideTextDocumentContent.findFiles.cache", undefined, {
                        logEntryCount: "" + this.logEntryCache.length,
                    });
                }

                throwIfCancellation(token);
                progress.report({ increment: 10 });

                // Group files by service and sort them by date
                const serviceFiles = this.groupAndSortFiles(this.logFileCache, token);
                this.logger.info("provideTextDocumentContent.groupAndSortFiles.success", undefined, {
                    serviceFileCount: "" + serviceFiles.length,
                });
                progress.report({ increment: 25 });

                throwIfCancellation(token);

                // Read and parse all log files
                const logEntries = await this.provideLogEntries(serviceFiles);
                progress.report({ increment: 30 });

                throwIfCancellation(token);

                // Group log entries by second
                let groupedLogEntries: Map<number, LogEntry[]>;
                try {
                    groupedLogEntries = this.groupLogEntriesBySecond(logEntries, token);
                } catch (error) {
                    this.logger.logException(
                        "provideTextDocumentContent.groupLogEntriesBySecond",
                        error,
                        "Error while grouping log entries.",
                        undefined,
                        true,
                        "Group log entries"
                    );
                    return JSON.stringify(error);
                }
                progress.report({ increment: 15 });

                throwIfCancellation(token);

                // Filter grouped log entries
                const filteredLogEntires = this.filterLogContent(groupedLogEntries, token);

                progress.report({ increment: 10 });

                throwIfCancellation(token);

                // Generate content for the virtual document
                const content = this.generateDocumentContent(filteredLogEntires, token);

                progress.report({ increment: 9 });
                this.logger.info("provideTextDocumentContent.end", undefined, {
                    changeTrigger: "" + this.changeTrigger,
                    filteredLogEntires: "" + filteredLogEntires.size,
                    contentLength: "" + content.length,
                });
                this.onTextDocumentGenerationFinished.fire(content);
                return content;
            }
        );
    }

    /**
     * Generates log entries from cache or by iterating over the service files.
     * This will not include filtering logic.
     * @param serviceFiles The service files to generate the log entries from.
     * @returns A list of (unfiltered) log entries.
     */
    private async provideLogEntries(serviceFiles: ServiceFiles[]): Promise<Array<LogEntry>> {
        if (this.logEntryCache.length > 0) {
            this.logger.info("provideLogEntries.cache", undefined, { logEntryCount: "" + this.logEntryCache.length });
            return this.logEntryCache;
        }

        this.logger.info("provideLogEntries.read.start", undefined, {
            serviceFileCount: "" + serviceFiles.length,
            maxFilesToRead: "" + MAX_LOG_FILES_PER_SERVICE,
            changeTrigger: "" + this.changeTrigger,
            serviceFiles: serviceFiles.map(s => s.serviceName).join(", "),
        });
        let filesRead = 0;
        let logEntriesRead = 0;

        // Read and parse all log files
        let logEntries: LogEntry[] = [];
        for (const filesForService of serviceFiles) {
            // Get the most recent two files for each service
            const recentFiles = filesForService.files.slice(0, MAX_LOG_FILES_PER_SERVICE);
            this.logger.info("provideLogEntries.readFiles", undefined, {
                serviceName: filesForService.serviceName,
                fileCount: "" + recentFiles.length,
                files: recentFiles.map(f => f.fsPath.split("/").pop() || "").join("', '"),
            });

            for (const file of recentFiles) {
                filesRead++;
                const content = await fs.readFile(file.fsPath, "utf8");
                const fileLogEntries = this.parseLogContent(content, filesForService.serviceName, logEntriesRead);
                logEntriesRead += fileLogEntries.length;
                logEntries = logEntries.concat(fileLogEntries);
            }
        }
        this.logger.info("provideLogEntries.read.end", undefined, { filesRead: "" + filesRead, logEntriesRead: "" + logEntriesRead });

        // Sort log entries by date
        logEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

        this.logger.info("provideLogEntries.sort.end");

        this.logEntryCache = logEntries;
        return this.logEntryCache;
    }

    /**
     * Groups the given files by service and sorts them by date.
     * @param files The files to group and sort.
     * @param token The cancellation token.
     * @returns A record of service names and their files.
     */
    private groupAndSortFiles(files: vscode.Uri[], token: vscode.CancellationToken): ServiceFiles[] {
        const fileGroups: Record<string, ServiceFiles> = {};

        if (this.logEntryCache.length > 0) {
            this.logger.info("groupAndSortFiles.cache", undefined, { logEntryCount: "" + this.logEntryCache.length });
            return [];
        }
        this.logger.info("groupAndSortFiles.start", undefined, { fileCount: "" + files.length });

        for (const file of files) {
            throwIfCancellation(token);
            const separatedFilepaths = file.path.split("/");
            let filename = separatedFilepaths.pop();
            const folder = separatedFilepaths.pop();

            // in T2.1 weblogs will be in folders starting with core or user
            // these folders will contain files with the same name however, we should not group them together
            if (folder?.startsWith("Core")) {
                filename = "core-" + filename;
            } else if (folder?.startsWith("User")) {
                // get the guid from the folder name
                // example User (Primary; 05f3f692-27ba-4a63-a862-cc66a146f3f3)
                // use the first 5 characters of the guid
                const guid = folder.match(GUID_REGEX);
                filename = "user-" + (guid ? guid[0].substring(0, 5) : "") + "-" + filename;
            }

            if (filename) {
                const parts = filename.split("_");
                let serviceName = parts[0];

                // remove the file extension
                serviceName = serviceName.split(".")[0];

                this.logger.info(
                    "groupAndSortFiles.foundFile",
                    `Found log file for service '${serviceName}' in folder '${folder}' - Filename: ${filename}.`,
                    { serviceName, folder, filename }
                );

                if (fileGroups[serviceName]) {
                    fileGroups[serviceName].files.push(file);
                    continue;
                }

                this.lengthOfLongestFileName = Math.max(this.lengthOfLongestFileName, serviceName.length);
                fileGroups[serviceName] = {
                    serviceName,
                    files: [file],
                };
            }
        }

        // Sort files within each group by date
        const result: ServiceFiles[] = [];
        for (const serviceName in fileGroups) {
            throwIfCancellation(token);
            // only sort files if there are more than 2 files
            if (fileGroups[serviceName].files.length >= MAX_LOG_FILES_PER_SERVICE) {
                fileGroups[serviceName].files = fileGroups[serviceName].files.sort((a, b) => {
                    const aTimestamp = this.extractTimestampFromFilePath(a.path);
                    const bTimestamp = this.extractTimestampFromFilePath(b.path);
                    return bTimestamp - aTimestamp; // Sort in descending order
                });
            }
            result.push(fileGroups[serviceName]);
        }

        this.logger.info("groupAndSortFiles.end", undefined, {
            serviceFileCount: "" + result.length,
            lengthOfLongestFileName: "" + this.lengthOfLongestFileName,
        });
        return result;
    }

    /**
     * Extracts the timestamp from the given file path.
     * Example: MSTeams_2023-11-23_12-40-44.33.log.
     * @param filePath The file path to extract the timestamp from.
     * @returns The timestamp of the file.
     */
    private extractTimestampFromFilePath(filePath: string): number {
        const regex = /_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/;
        const match = filePath.match(regex);

        // will convert the capture group 2024-02-01_17-11-00 to two array entries
        let [datePart, timePart] = match ? match[1].split("_") : ["", ""];
        timePart = timePart.replace(/-/g, ":");
        return new Date(`${datePart} ${timePart}`).getTime() || 0;
    }

    /**
     * Parses the content of a log file and returns log entries with their dates.
     * @param content The content of the log file.
     * @param serviceName The name of the service that generated the log file.
     * @param logEntriesRead The number of log entries read so far. This is used as a unique identifier for each log entry.
     * @returns An array of log entries with their dates.
     */
    private parseLogContent(content: string, serviceName: string, logEntriesRead: number): Array<LogEntry> {
        this.stringReplacementMap.forEach(replacement => {
            content = content.replaceAll(replacement.searchString, replacement.replacementString);
        });

        return content.split("\n").map(line => {
            const date = this.extractDateFromLogEntry(line);
            logEntriesRead++;
            return {
                date: date,
                text: `[${this.padZero(logEntriesRead)}]${line}`,
                service: serviceName,
            };
        });
    }

    /**
     * Extracts a date from the given log entry.
     * @param line The line to extract the date from.
     * @param useDesktopTimezoneWorkaroundFix At the moment, desktop logs report the time in UTC but also include the timezone offset.
     * If `true` we will ignore the timezone offset and pretend that the time is reported as UTC.
     * Once the desktop team has fixed the logs, we can remove this workaround.
     * @returns The date extracted from the log entry. If no date is found, the epoch date is returned.
     */
    private extractDateFromLogEntry(line: string, useDesktopTimezoneWorkaroundFix = true): Date {
        // matches 2023-11-28T15:16:31.758465+00:00
        // matches 2024-02-08T18:11:06.702420-08:00
        // The date is in the first capture group
        const isoDateRegex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{6})[\+|-]\d{2}:\d{2}/;

        // matches Sun Jan 07 2024 18:45:43 GMT-0800 (Pacific Standard Time)
        // The date is in the first capture group
        const webDateRegexT1 = /(\w{3} \w{3} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[\+|-]\d{4})/;

        // matches 01/04/24 01:31:00.824 AM -08
        // matches 01/04/24 01:31:00.824 AM +08
        // The date is in the first capture group
        const webDateRegexSkype = /(\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}.\d{3} [A|P]M [-|\+]\d{2})/;

        const isoDateMatch = line.match(isoDateRegex);
        if (isoDateMatch) {
            if (useDesktopTimezoneWorkaroundFix) {
                // return the first capture group which is only the date without the timezone offset
                return new Date(isoDateMatch[1]);
            }
            return new Date(isoDateMatch[0]);
        }

        const match = line.match(WEB_DATE_REGEX) || line.match(webDateRegexT1) || line.match(webDateRegexSkype);
        const date = match ? new Date(match[1]) : EPOCH_DATE; // If no date is found, return the epoch date
        return date;
    }

    /**
     * Pads a number with zeros to the left so that it always has 6 digits.
     * @param num The number to pad with zeros.
     * @returns The number padded with zeros.
     */
    private padZero(num: number): string {
        return num.toString().padStart(7, "0");
    }

    /**
     * Filters out keywords and time ranges.
     *
     * This method is dynamic and depends on the filters enabled. It has to be called every time the filters change.
     * @param groupedLogs The log entries to filter. Grouped by second.
     * @param token The cancellation token.
     * @returns A filtered array of log entries.
     */
    private filterLogContent(groupedLogs: Map<number, LogEntry[]>, token: vscode.CancellationToken): Map<number, LogEntry[]> {
        // Filter out log entries based on the time first
        const filteredLogs = new Map<number, LogEntry[]>();
        const logLevelRegex = this.buildLogLevelRemoveRegEx();
        const shouldRemoveLogLevels = logLevelRegex !== null;
        this.logger.info("filterLogContent.start", undefined, { logLevelRegex: shouldRemoveLogLevels ? logLevelRegex.source : "-" });

        let totalLogLines = 0;
        for (const [timestamp, logs] of groupedLogs) {
            throwIfCancellation(token);
            const shouldStay = this.matchesTimeFilter(timestamp);
            if (shouldStay) {
                // Filter out log entries based on the keywords
                const filteredLogsEntries = logs.filter(entry => {
                    return entry.isMarker || (this.matchesKeywordFilter(entry.text) && this.matchesLogLevel(entry.text, logLevelRegex));
                });

                filteredLogs.set(timestamp, filteredLogsEntries);
                totalLogLines += filteredLogsEntries.length;
            } else {
                this.logger.info("filterLogContent.filterOut", undefined, {
                    groupTimestamp: "" + timestamp,
                    filteredOut: "" + logs.length,
                });
            }
        }
        this.logger.info("filterLogContent.end", undefined, {
            filteredOut: `${groupedLogs.size - filteredLogs.size}`,
            totalLogLines: "" + totalLogLines,
        });
        return filteredLogs;
    }

    /**
     * Checks if the given log entry should be filtered out.
     * @param logEntryLine The log entry to check.
     * @returns True if the log entry should stay, false if it should be filtered out.
     */
    private matchesKeywordFilter(logEntryLine: string): boolean {
        if (this.keywordFilters.length > 0) {
            // Check if the log entry contains any of the keywords
            const keywordRegex = new RegExp(this.keywordFilters.join("|"));
            const keywordMatch = logEntryLine.match(keywordRegex);
            if (!keywordMatch) {
                return false;
            }
        }

        return true;
    }

    /**
     * Builds a regex that combines all regular expressions that remove any line has a log level that is not allowed.
     * @returns A new regex to remove log levels.
     */
    private buildLogLevelRemoveRegEx = (): RegExp | null => {
        if (this.disabledLogLevels.length === 0) {
            return null;
        }

        const regExToUse: string[] = [];
        for (const levelToRemove of this.disabledLogLevels) {
            regExToUse.push(LOG_LEVEL_REGEX[levelToRemove].source);
        }
        return new RegExp(regExToUse.join("|"));
    };

    /**
     * Checks if the given log entry should be filtered out based on log level.
     * @param logEntryLine The line to check.
     * @param regEx The regex to check against.
     * @returns True if the log entry should stay, false if it should be filtered out.
     */
    private matchesLogLevel(logEntryLine: string, regEx: RegExp | null): boolean {
        if (!regEx) {
            return true;
        }

        const logLevelMatch = logEntryLine.match(regEx);
        if (logLevelMatch) {
            return false;
        }
        return true;
    }

    /**
     * Checks if the given group of log entries should be filtered out based on time filters.
     * @param groupTimestamp The timestamp of the group to check.
     * @returns True if the group should stay, false if it should be filtered out.
     */
    private matchesTimeFilter(groupTimestamp: number): boolean {
        if (this.timeFilterFromDate && groupTimestamp < this.timeFilterFromDate.getTime()) {
            return false;
        }

        if (this.timeFilterTillDate && groupTimestamp > this.timeFilterTillDate.getTime()) {
            return false;
        }

        return true;
    }

    /**
     * Groups the given log entries by second.
     * This assumes that the list of log entries is sorted by date and not filtered.
     * @param logEntries The list of log entries to group by second.
     * @param token The cancellation token.
     * @returns A map of log entries grouped by second.
     */
    private groupLogEntriesBySecond(logEntries: LogEntry[], token: vscode.CancellationToken): Map<number, LogEntry[]> {
        if (this.groupedLogEntries.size > 0) {
            this.logger.info("groupLogEntriesBySecond.cached", undefined, { groupCount: "" + this.groupedLogEntries.size });
            return this.groupedLogEntries;
        }

        this.logger.info("groupLogEntriesBySecond.start", undefined, { logEntryCount: "" + logEntries.length });

        let currentSecond: Date | null = null;
        let currentGroup = new Array<LogEntry>();
        for (const entry of logEntries) {
            // Check if the entry is in a new second
            if (!currentSecond || entry.date.getSeconds() !== currentSecond.getSeconds()) {
                throwIfCancellation(token);
                if (currentSecond !== null) {
                    // Add a foldable region marker (this is a placeholder, actual folding is handled elsewhere)
                    const marker = `${LogContentProvider.foldingRegionPrefix}${LogContentProvider.foldingRegionEndMarker}\n`;
                    currentGroup.push({ date: currentSecond, text: marker, isMarker: true });

                    // since this is the end of a group, add the current group to the map
                    this.groupedLogEntries.set(currentSecond.getTime(), currentGroup);
                    currentGroup = new Array<LogEntry>();
                }

                currentSecond = entry.date;
                try {
                    // Add a foldable region marker (this is a placeholder, actual folding is handled elsewhere)
                    const startMarker = `${LogContentProvider.foldingRegionPrefix}${currentSecond.toISOString()}\n`;
                    currentGroup.push({ date: currentSecond, text: startMarker, isMarker: true });
                } catch (error) {
                    this.logger.logException(
                        "groupLogEntriesBySecond.startMarker",
                        error,
                        "Error while adding start marker.",
                        undefined,
                        true,
                        "Start marker"
                    );
                    throw error;
                }
            }

            // removes all information that is not needed one by one
            // stringsToRemove is a static list so we can cache the result
            const entryText = this.stringsToRemove.reduce((text, regex) => text.replace(regex, ""), entry.text);
            currentGroup.push({ date: entry.date, text: entryText, service: entry.service });
        }

        // Add the last group to the map
        if (currentSecond !== null) {
            this.groupedLogEntries.set(currentSecond.getTime(), currentGroup);
        }

        this.logger.info("groupLogEntriesBySecond.end", undefined, { groupCount: "" + this.groupedLogEntries.size });
        return this.groupedLogEntries;
    }

    /**
     * Generates the content for the virtual document.
     * @param groupedEntries The log entries to include in the document.
     * @param token The cancellation token.
     * @returns The content of the virtual document.
     */
    private generateDocumentContent(groupedEntries: Map<number, LogEntry[]>, token: vscode.CancellationToken): string {
        let documentContent = "";

        this.logger.info("generateDocumentContent.start", undefined, { groupCount: "" + groupedEntries.size });
        groupedEntries.forEach(logEntries => {
            throwIfCancellation(token);
            // skip if only two entries are present (start and end marker)
            if (logEntries.length > 2) {
                logEntries.forEach(entry => {
                    documentContent += `${this.getLogLinePrefix(entry)}${entry.text}\n`;
                });
            }
        });

        return documentContent;
    }

    /**
     * Gets the file name prefix for the log entry. This function makes sure that the prefix is always the length of the longest file name.
     * @param logEntry The log entry to get the file name prefix from.
     * @returns The file name prefix for the log entry.
     */
    private getLogLinePrefix(logEntry: LogEntry): string {
        let prefix = "";
        if (this._displayFileNames && logEntry.service) {
            // make sure that the prefix is always the same length
            const fileNamePrefix = logEntry.service.padEnd(this.lengthOfLongestFileName, " ");

            prefix = `[${fileNamePrefix}]`;
        }

        if (this._displayDatesInLine && !logEntry.isMarker) {
            const hours = logEntry.date.getUTCHours().toString().padStart(2, "0");
            const minutes = logEntry.date.getUTCMinutes().toString().padStart(2, "0");
            const seconds = logEntry.date.getUTCSeconds().toString().padStart(2, "0");
            const milliseconds = logEntry.date.getUTCMilliseconds().toString().padStart(3, "0");
            prefix += `[${hours}:${minutes}:${seconds}.${milliseconds}]`;
        }
        return prefix.length > 0 ? prefix + " " : "";
    }
}
































































































