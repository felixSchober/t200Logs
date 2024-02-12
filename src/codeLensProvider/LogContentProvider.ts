/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as fs from "fs/promises";

import * as vscode from "vscode";

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
};

export type DisplaySettingsChangedEvent = {
    /**
     * Whether to display the file names. A null value means that the user did not change the setting.
     */
    displayFileNames: boolean | null;

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

const MAX_LOG_FILES_PER_SERVICE = 2;

const MAX_LOG_FILES_RETURNED = 100;

/**
 * A content provider that transforms the content of a log file.
 */
export class LogContentProvider implements vscode.TextDocumentContentProvider {
    private readonly guidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g;

    /**
     * Filter out log entries that are before this date.
     */
    private timeFilterFrom: string | null;

    /**
     * The minimum date that can be used as a filter except if the user wants to display all entries.
     */
    private minimumDate: string | null = new Date(1000).toISOString();

    /**
     * Filter out log entries that are after this date.
     */
    private timeFilterTill: string | null = null;

    /**
     * Filter out log entries that do not contain either of these keywords.
     */
    private keywordFilters: string[] = [];

    /**
     * A list of log files that are used to render the text content.
     * This list will only be set on the first call to provideTextDocumentContent.
     */
    private logFileCache: vscode.Uri[] = [];

    /**
     * A list of lines from the log files generated at the start when the class is initialized.
     */
    private logEntryCache: LogEntry[] = [];

    public static readonly documentScheme = "log-viewer";

    public static readonly foldingRegionEndMarker = "======";

    /**
     * The prefix for the folding region markers. E.g. // ====== or // 2023-11-28T15:16:31.758465+00:00.
     */
    public static readonly foldingRegionPrefix = "// ";

    public static readonly documentUri = vscode.Uri.parse(`${this.documentScheme}:/log-viewer.log`);

    /**
     * Strings to remove from the log entries.
     */
    private stringsToRemove = [
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(\+|-)\d{2}:\d{2}/, // 2023-11-28T15:16:31.758465+00:00
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, // 2023-11-29T10:21:49.895Z
        /\w{3} \w{3} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT(\+|-)\d{4} \(\D*\)/, // Sun Jan 07 2024 18:45:43 GMT-0800 (Pacific Standard Time)
        /\s0x[0-9a-f]{8}/, //  0x00001f68 (ProcessIds) with two spaces before
        /\sInf\s/,
        /-logs\.txt/,
        /<\d{5}>/,
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
     * Creates a new instance of the LogContentProvider class.
     * @param onFilterChangeEvent The event that is fired when the filter changes.
     * @param onDisplaySettingsChangedEvent The event that is fired when the display settings change.
     */
    constructor(
        onFilterChangeEvent: vscode.Event<FilterChangedEvent>,
        onDisplaySettingsChangedEvent: vscode.Event<DisplaySettingsChangedEvent>
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
                    this.stringsToRemove = this.stringsToRemove.filter(regex => regex.source !== this.guidRegex.source);
                } else {
                    this.stringsToRemove.push(this.guidRegex);
                }
            }
            this._onDidChange.fire(LogContentProvider.documentUri);
        });

        // set the "timeFilterFrom" to a second after timestamp 0.
        // This is done so that we ignore all events that do not have a timestamp.
        this.timeFilterFrom = this.minimumDate;
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

        this.changeTrigger++;
        this._onDidChange.fire(LogContentProvider.documentUri);
    }

    /**
     * Calculates the number of filters that are currently active.
     * @returns The number of filters that are currently active.
     */
    public getNumberOfActiveFilters(): number {
        const numberOfKeywordFilters = this.keywordFilters.length;
        const numberOfTimeFilters = (this.timeFilterFrom ? 1 : 0) + (this.timeFilterTill ? 1 : 0);
        const isErrorLevelChecked = true;
        const isWarningLevelChecked = true;
        const isVerboseLevelChecked = true;

        return (
            numberOfKeywordFilters +
            numberOfTimeFilters +
            (isErrorLevelChecked ? 0 : 1) +
            (isWarningLevelChecked ? 0 : 1) +
            (isVerboseLevelChecked ? 0 : 1)
        );
    }

    /**
     * Provide textual content for a given uri.
     * @param _ An uri which scheme matches the scheme this provider was created for.
     * @returns A string representing the textual content.
     */
    async provideTextDocumentContent(_: vscode.Uri): Promise<string> {
        if (!vscode.workspace.workspaceFolders) {
            return "";
        }

        console.log("Content requested for changeTrigger:", this.changeTrigger);
        if (this.logFileCache.length === 0) {
            this.logFileCache = await vscode.workspace.findFiles("**/*.{log,txt}", "**/node_modules/**", MAX_LOG_FILES_RETURNED);
            console.log(`Found ${this.logFileCache.length} log files.`);
        } else {
            console.log("Using cached log files.");
        }

        // Group files by service and sort them by date
        const serviceFiles = this.groupAndSortFiles(this.logFileCache);
        console.log(`Grouped log files into ${serviceFiles.length} services.`);

        // Read and parse all log files
        const logEntries = await this.provideLogEntries(serviceFiles);
        const filteredLogEntires = this.filterLogContent(logEntries);

        // Generate content for the virtual document
        return this.generateDocumentContent(filteredLogEntires);
    }

    /**
     * Generates log entries from cache or by iterating over the service files.
     * This will not include filtering logic.
     * @param serviceFiles The service files to generate the log entries from.
     * @returns A list of (unfiltered) log entries.
     */
    private async provideLogEntries(serviceFiles: ServiceFiles[]): Promise<Array<LogEntry>> {
        if (this.logEntryCache.length > 0) {
            console.log(`Skipping generation of log entries - Found ${this.logEntryCache.length} lines in cache`);
            return this.logEntryCache;
        }

        console.log(
            `Reading ${serviceFiles.length} log files types. Each service can contain up to ${MAX_LOG_FILES_PER_SERVICE} files to read.`
        );
        console.debug("Service files:", serviceFiles.map(s => s.serviceName).join(", "));
        let filesRead = 0;

        // Read and parse all log files
        let logEntries: LogEntry[] = [];
        for (const filesForService of serviceFiles) {
            // Get the most recent two files for each service
            const recentFiles = filesForService.files.slice(0, MAX_LOG_FILES_PER_SERVICE);
            console.log(`Reading ${recentFiles.length} log files for service ${filesForService.serviceName}.`);
            for (const file of recentFiles) {
                filesRead++;
                const content = await fs.readFile(file.fsPath, "utf8");
                logEntries = logEntries.concat(this.parseLogContent(content, filesForService.serviceName));
            }
        }
        console.log(`Read ${filesRead} log files. Found ${logEntries.length} log entries.`);

        // Sort log entries by date
        logEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

        this.logEntryCache = logEntries;
        return this.logEntryCache;
    }

    /**
     * Groups the given files by service and sorts them by date.
     * @param files The files to group and sort.
     * @returns A record of service names and their files.
     */
    groupAndSortFiles(files: vscode.Uri[]): ServiceFiles[] {
        const fileGroups: Record<string, ServiceFiles> = {};

        for (const file of files) {
            const filename = file.path.split("/").pop();
            if (filename) {
                const parts = filename.split("_");
                const serviceName = parts[0];

                if (fileGroups[serviceName]) {
                    fileGroups[serviceName].files.push(file);
                    continue;
                }

                fileGroups[serviceName] = {
                    serviceName,
                    files: [file],
                };
            }
        }

        // Sort files within each group by date
        const result: ServiceFiles[] = [];
        for (const serviceName in fileGroups) {
            // only sort files if there are more than 2 files
            if (fileGroups[serviceName].files.length < MAX_LOG_FILES_PER_SERVICE) {
                fileGroups[serviceName].files.sort((a, b) => {
                    const aTimestamp = this.extractTimestamp(a.path);
                    const bTimestamp = this.extractTimestamp(b.path);
                    return bTimestamp - aTimestamp; // Sort in descending order
                });
            }
            result.push(fileGroups[serviceName]);
        }

        return result;
    }

    /**
     * Extracts the timestamp from the given file path.
     * Example: MSTeams_2023-11-23_12-40-44.33.log.
     * @param filePath The file path to extract the timestamp from.
     * @returns The timestamp of the file.
     */
    extractTimestamp(filePath: string): number {
        const regex = /_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/;
        const match = filePath.match(regex);
        return match ? new Date(match[1].replace(/-/g, "/").replace("_", " ")).getTime() : 0;
    }

    /**
     * Parses the content of a log file and returns log entries with their dates.
     * @param content The content of the log file.
     * @param serviceName The name of the service that generated the log file.
     * @returns An array of log entries with their dates.
     */
    private parseLogContent(content: string, serviceName: string): Array<LogEntry> {
        // matches 2023-11-28T15:16:31.758465+00:00
        const isoDateRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{6}(\+|-)\d{2}:\d{2}/;

        // matches 2023-11-29T10:21:49.895Z
        const webDateRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;

        // matches Sun Jan 07 2024 18:45:43 GMT-0800 (Pacific Standard Time)
        const webDateRegexT1 = /\w{3} \w{3} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT(\+|-)\d{4}/;

        // matches 01/04/24 01:31:00.824 AM -08
        const webDateRegexSkype = /\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}.\d{3} (AM|PM) (-|\+)\d{2}/;

        this.stringReplacementMap.forEach(replacement => {
            content = content.replaceAll(replacement.searchString, replacement.replacementString);
        });

        return content.split("\n").map(line => {
            const match =
                line.match(isoDateRegex) || line.match(webDateRegex) || line.match(webDateRegexT1) || line.match(webDateRegexSkype);
            return {
                date: match ? new Date(match[0]) : new Date(0), // Default to epoch if no date found
                text: line,
                service: serviceName,
            };
        });
    }

    /**
     * Filters out keywords and time ranges.
     * @param logs The log entries to filter.
     * @returns A filtered array of log entries.
     */
    private filterLogContent(logs: Array<LogEntry>): Array<LogEntry> {
        return logs.filter(entry => {
            return this.matchesTimeFilter(entry) && this.matchesKeywordFilter(entry.text);
        });
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
     * Checks if the given log entry should be filtered out.
     * @param logEntry The log entry to check.
     * @returns True if the log entry should stay, false if it should be filtered out.
     */
    private matchesTimeFilter(logEntry: LogEntry): boolean {
        // make sure the filter is defined and a valid date
        if (this.timeFilterFrom && !isNaN(Date.parse(this.timeFilterFrom))) {
            const timeFrom = new Date(this.timeFilterFrom);
            if (logEntry.date < timeFrom) {
                return false;
            }
        }

        if (this.timeFilterTill && !isNaN(Date.parse(this.timeFilterTill))) {
            const timeTill = new Date(this.timeFilterTill);
            if (logEntry.date > timeTill) {
                return false;
            }
        }

        return true;
    }

    /**
     * Generates the content for the virtual document.
     * @param logEntries The log entries to include in the document.
     * @returns The content of the virtual document.
     */
    generateDocumentContent(logEntries: Array<LogEntry>): string {
        let currentSecond: Date | null = null;
        let documentContent = "";

        for (const entry of logEntries) {
            // Check if the entry is in a new second
            if (!currentSecond || entry.date.getSeconds() !== currentSecond.getSeconds()) {
                if (currentSecond !== null) {
                    // Add a foldable region marker (this is a placeholder, actual folding is handled elsewhere)
                    documentContent += `${LogContentProvider.foldingRegionPrefix}${LogContentProvider.foldingRegionEndMarker}\n\n`;
                }
                currentSecond = entry.date;
                documentContent += `${LogContentProvider.foldingRegionPrefix}${currentSecond.toISOString()}\n`;
            }

            // removes all information that is not needed one by one
            const entryText = this.stringsToRemove.reduce((text, regex) => text.replace(regex, ""), entry.text);
            documentContent += `${this._displayFileNames ? entry.service : ""} ${entryText}\n`;
        }

        // replace the hex values at the beginning of each log line
        const hexRegex = /\s0x[0-9a-fA-F]{16}\s/g;
        documentContent = documentContent.replaceAll(hexRegex, "");

        return documentContent;
    }
}












































