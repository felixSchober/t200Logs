/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as fs from "fs/promises";

import {
    type IPostMessageService,
    type LogLevel,
    type PostMessageEventRespondFunction,
    type TimeFilterChangedEvent,
} from "@t200logs/common";
import { LogFile, LogFileList, LogFileType } from "@t200logs/common/src/model/LogFileList";
import * as vscode from "vscode";

import { ConfigurationManager } from "../../configuration";
import { DocumentLocationManager } from "../../configuration/DocumentLocationManager";
import { EPOCH_DATE } from "../../constants/constants";
import { ERROR_REGEX, GUID_REGEX, WARN_REGEX, WEB_DATE_REGEX } from "../../constants/regex";
import { PostMessageDisposableService } from "../../service/PostMessageDisposableService";
import { ScopedILogger } from "../../telemetry/ILogger";
import { ITelemetryLogger } from "../../telemetry/ITelemetryLogger";
import { throwIfCancellation } from "../../utils/throwIfCancellation";

import { HarFileProvider } from "./HarFileProvider";
import { LogContentFilters } from "./LogContentFilters";
import { LogEntry } from "./LogEntry";

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
    debug: /<DBG>|<DIAG>|Ver/,
    warning: WARN_REGEX,
    info: /(<INFO>)|Inf/,
};

/**
 * A content provider that transforms the content of a log file.
 */
export class LogContentProvider extends PostMessageDisposableService implements vscode.TextDocumentContentProvider {
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

    /**
     * The scheme for the log viewer document.
     */
    public static readonly documentScheme = "log-viewer";

    /**
     * The marker for the start of a folding region.
     */
    public static readonly foldingRegionEndMarker = "======";

    /**
     * The prefix for the folding region markers. E.g. // ====== or // 2023-11-28T15:16:31.758465+00:00.
     */
    public static readonly foldingRegionPrefix = "// ";

    /**
     * The uri for the log viewer document.
     */
    public static readonly documentUri = vscode.Uri.parse(`${this.documentScheme}:/log-viewer.log`);

    private readonly logger: ScopedILogger;

    /**
     * Strings to remove from the log entries.
     * This is a static list of strings that are removed from the log entries and the result is cached.
     */
    private staticStringsToRemove = [
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(\+|-)\d{2}:\d{2}/g, // 2023-11-28T15:16:31.758465+00:00
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, // 2023-11-29T10:21:49.895Z
        /\w{3} \w{3} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT(\+|-)\d{4} \(\D*\)/g, // Sun Jan 07 2024 18:45:43 GMT-0800 (Pacific Standard Time)
        /\s0x[0-9a-f]{8}/g, //  0x00001f68 (ProcessIds) with two spaces before
        /-logs\.txt/g,
        /<\d{5}>/g,
        /\s0x[0-9a-fA-F]{16}\s/g, // 0x0000000000000000 with spaces before and after
        /[0-9a-f]{8}\s/g, // d93f9c40 with a space after (process ids)
    ] as const;

    /**
     * Strings to remove from the log entries.
     * This is a dynamic list of strings that are removed from the log entries and the result is not cached cached.
     */
    private additionalStringsToRemove: RegExp[] = [];

    /**
     * Strings to replace in the log entries.
     */
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

    /**
     * Class that manages the filters for the log content.
     */
    private readonly filters: LogContentFilters;

    /**
     * A list of functions that should be called after {@link provideTextDocumentContent} is finished.
     */
    private readonly displaySettingsToRespondTo: PostMessageEventRespondFunction[] = [];

    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    private changeTrigger = 0;

    private _displayFileNames = true;

    /**
     * Whether to display the dates in line.
     */
    private _displayDatesInLine = false;

    /**
     * Event that is fired when the text document generation is finished.
     */
    public onTextDocumentGenerationFinished = new vscode.EventEmitter<string>();

    /**
     * Watcher for the log files in the workspace.
     */
    private readonly watcher: vscode.FileSystemWatcher;

    /**
     * The provider for the HAR files.
     */
    private readonly harFileProvider: HarFileProvider;

    /**
     * After we generate the content for the first time we want to update the cursor position in case the user wants
     * to resume reading from where they left off.
     *
     * We will only do this once after the content is generated.
     * After we've updated the cursor position we will set this to null.
     */
    private cursorPositionAfterContentGeneration: number | null;

    /**
     * Creates a new instance of the LogContentProvider class.
     * @param onFilterChangeEvent The event that is fired a filter changes through the code lens.
     * @param postMessageService The post message service to use for communication with the extension.
     * @param configurationManager The configuration manager.
     * @param documentLocationManager The document location manager to set the cursor position.
     * @param logger The logger.
     */
    constructor(
        onFilterChangeEvent: vscode.Event<TimeFilterChangedEvent>,
        private readonly postMessageService: IPostMessageService,
        configurationManager: ConfigurationManager,
        private readonly documentLocationManager: DocumentLocationManager,
        logger: ITelemetryLogger
    ) {
        super();
        this.logger = logger.createLoggerScope("LogContentProvider");

        this.filters = new LogContentFilters(
            onFilterChangeEvent,
            postMessageService,
            configurationManager,
            () => this.triggerDocumentChange(),
            () => this.logEntryCache,
            logger
        );
        this.registerDisplaySettingEvents();

        this.watcher = vscode.workspace.createFileSystemWatcher("**/*.{log,txt}", false, false, false);
        this.registerFileWatcherEvents();

        this.harFileProvider = new HarFileProvider(logger);
        this.cursorPositionAfterContentGeneration = configurationManager.restoredCursorPosition;
    }

    /**
     * Registers the display setting events for the log content provider.
     * This method is called in the constructor.
     *
     * Events are called when the user changes a display setting through the webview.
     * They are dispatched by the {@link ExtensionPostMessageService}.
     */
    private registerDisplaySettingEvents() {
        const displaySettingsChanged = this.postMessageService.registerMessageHandler("displaySettingsChanged", (event, respond) => {
            let shouldChangeDocument = false;
            if (event.displayFileNames !== null && this._displayFileNames !== event.displayFileNames) {
                this._displayFileNames = event.displayFileNames;
                shouldChangeDocument = true;
            }

            const hideGuids = !event.displayGuids;
            const isHidingGuids = this.additionalStringsToRemove.some(regex => regex.source === GUID_REGEX.source);
            if (event.displayGuids !== null && isHidingGuids !== hideGuids) {
                // if the user wants to display the guids, remove the regex that removes them
                if (event.displayGuids) {
                    this.additionalStringsToRemove = this.additionalStringsToRemove.filter(regex => regex.source !== GUID_REGEX.source);
                } else {
                    this.additionalStringsToRemove.push(GUID_REGEX);
                }
                shouldChangeDocument = true;
            }

            if (event.displayDatesInLine !== null && this._displayDatesInLine !== event.displayDatesInLine) {
                this._displayDatesInLine = event.displayDatesInLine;
                shouldChangeDocument = true;
            }

            if (shouldChangeDocument) {
                this.displaySettingsToRespondTo.push(respond);
                this.triggerDocumentChange();
            } else {
                this.logger.info("displaySettingsChanged.noChange", undefined, {
                    displayFileNames: "" + event.displayFileNames,
                    displayGuids: "" + event.displayGuids,
                    displayDatesInLine: "" + event.displayDatesInLine,
                });
                respond({
                    command: "messageAck",
                    data: undefined,
                });
            }
        });
        this.unregisterListeners.push(displaySettingsChanged);
    }

    /**
     * Disposes of the LogContentProvider.
     */
    public override dispose() {
        super.dispose();
        this.watcher.dispose();
        this.filters.dispose();
    }

    /**
     * Registers a file watcher for the log files in the workspace so that we can re-fetch the log files and re-generate the content.
     */
    private registerFileWatcherEvents() {
        this.watcher.onDidChange(uri => {
            this.logger.info("registerFileWatcher.onDidChange", undefined, { uri: uri.fsPath });
            this.reset();
        });
        this.watcher.onDidCreate(uri => {
            this.logger.info("registerFileWatcher.onDidCreate", undefined, { uri: uri.fsPath });
            this.reset();
        });
        this.watcher.onDidDelete(uri => {
            this.logger.info("registerFileWatcher.onDidDelete", undefined, { uri: uri.fsPath });
            this.reset();
        });
    }

    /**
     * Resets the cache and filters causing the content provider to re-fetch the log files and re-generate the content.
     * @param resetFilters Whether to reset the filters as well. Default is false.
     */
    public reset(resetFilters = false) {
        this.logger.info("reset");
        this.logFileCache = [];
        this.logEntryCache = [];
        this.groupedLogEntries = new Map();
        this.harFileProvider.clearCache();
        if (resetFilters) {
            this.filters.reset();
        }

        this.changeTrigger++;
        this._onDidChange.fire(LogContentProvider.documentUri);
    }

    /**
     * Triggers a document change event.
     */
    private triggerDocumentChange() {
        this.changeTrigger++;
        this._onDidChange.fire(LogContentProvider.documentUri);
    }

    /**
     * Provide textual content for a given uri.
     * @param documentUri An uri which scheme matches the scheme this provider was created for.
     * @returns A string representing the textual content.
     */
    public async provideTextDocumentContent(documentUri: vscode.Uri): Promise<string> {
        if (!vscode.workspace.workspaceFolders) {
            this.logger.logException(
                "provideTextDocumentContent.noWorkspaceFolder",
                new Error("No workspace folder found."),
                "No workspace folder found. Please open the folder containing the Teams Logs and try again.",
                {
                    uri: documentUri.fsPath,
                },
                true,
                "No workspace folder"
            );
            return "Please open a folder containing the Teams Logs and try again.";
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

                progress.report({ increment: 1, message: "Waiting for vscode UI thread" });
                progress.report({ increment: 1, message: "Finding files" });

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
                progress.report({ increment: 10, message: "Grouping files" });

                // Group files by service and sort them by date
                const serviceFiles = this.groupAndSortFiles(this.logFileCache, token);
                this.logger.info("provideTextDocumentContent.groupAndSortFiles.success", undefined, {
                    serviceFileCount: "" + serviceFiles.length,
                });
                progress.report({ increment: 24, message: "Parsing log entries" });

                throwIfCancellation(token);

                // Read and parse all log files
                const logEntries = await this.provideLogEntries(serviceFiles);
                progress.report({ increment: 10, message: "Parsing HAR files" });
                const harEntries = await this.harFileProvider.getEntries(token);

                progress.report({ increment: 20, message: "Grouping log entries by time" });
                throwIfCancellation(token);

                // Group log entries by second
                let groupedLogEntries: Map<number, LogEntry[]>;
                try {
                    groupedLogEntries = this.groupLogEntriesBySecond(logEntries, harEntries, token);
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
                progress.report({ increment: 20, message: "Filtering log entries" });

                throwIfCancellation(token);

                // Filter grouped log entries
                const filteredLogEntires = this.filterLogContent(groupedLogEntries, token);

                progress.report({ increment: 10, message: "Generating content" });

                throwIfCancellation(token);

                // Generate content for the virtual document
                let content = this.generateDocumentContent(filteredLogEntires, token);

                progress.report({ increment: 4, message: "Removing unnecessary strings" });

                // go over the list of additional strings to remove and remove them from the content
                for (const regex of this.additionalStringsToRemove) {
                    this.logger.info("provideTextDocumentContent.removeAdditionalStrings", undefined, { regex: regex.source });
                    regex.lastIndex = 0;
                    content = content.replaceAll(regex, "[GUID]");
                }
                progress.report({ increment: 5, message: "Waiting for vscode rendering to complete" });
                this.logger.info("provideTextDocumentContent.end", undefined, {
                    changeTrigger: "" + this.changeTrigger,
                    filteredLogEntires: "" + filteredLogEntires.size,
                    contentLength: "" + content.length,
                });
                this.onTextDocumentGenerationFinished.fire(content);
                this.respondToMessages();

                // update the cursor position if we have a position to update
                // we have to wait for the content to be generated before we can update the cursor position
                this.updateCursorPosition(token);

                this.updateFileList(logEntries, filteredLogEntires, token);

                return content;
            }
        );
    }

    /**
     * Updates the cursor position after the content is generated.
     * @param token The cancellation token.
     */
    private updateCursorPosition(token: vscode.CancellationToken) {
        const cursorPosition = this.cursorPositionAfterContentGeneration;
        if (cursorPosition) {
            setTimeout(() => {
                this.logger.info("provideTextDocumentContent.setCursor", undefined, {
                    cursorPositionAfterContentGeneration: "" + cursorPosition,
                });
                throwIfCancellation(token);
                this.documentLocationManager.setCursor(cursorPosition);
                this.cursorPositionAfterContentGeneration = null;
            }, 1000);
        }
    }

    /**
     * Sends a message to the webview to update the file list after the content is generated.
     * @param nonFilteredLogEntries The log entries before filtering and grouping.
     * @param filteredLogEntries Map of the log entries after filtering and grouping. The key is the timestamp in seconds and the value is the log entries for that second.
     * @param token The cancellation token.
     */
    private updateFileList(
        nonFilteredLogEntries: LogEntry[],
        filteredLogEntries: Map<number, LogEntry[]>,
        token: vscode.CancellationToken
    ): void {
        this.logger.info("updateFileList");
        throwIfCancellation(token);
        const files: Record<string, LogFile> = {};
        const fileKeys: string[] = [];

        for (const logEntry of nonFilteredLogEntries) {
            const serviceName = logEntry.service;
            if (!serviceName) {
                continue; // skip log entries without a service name
            }

            if (!files[serviceName]) {
                throwIfCancellation(token);
                files[serviceName] = {
                    fileName: serviceName,
                    fileType: this.getFileTypeFromService(serviceName),
                    numberOfEntries: 0,
                    numberOfFilteredEntries: 0,
                };
                fileKeys.push(serviceName);
            }
            files[serviceName].numberOfEntries++;
        }
        this.logger.info("updateFileList.nonFiltered", undefined, { fileCount: "" + fileKeys.length });
        throwIfCancellation(token);

        // go over the filtered log entries and update the number of filtered entries for each file
        for (const [, logEntries] of filteredLogEntries) {
            for (const logEntry of logEntries) {
                const serviceName = logEntry.service;
                if (!serviceName) {
                    continue; // skip log entries without a service name
                }

                if (!files[serviceName]) {
                    // this should never happen because we already went over all unfiltered the log entries
                    this.logger.logException(
                        "updateFileList.missingService",
                        new Error(`Service name not found in the list of files: ${serviceName}`),
                        "Service name not found in the list of files."
                    );
                    continue;
                }
                files[serviceName].numberOfFilteredEntries++;
            }
        }
        this.logger.info("updateFileList.filtered");
        throwIfCancellation(token);
        const fileList: LogFileList = fileKeys.map(key => files[key]);
        this.postMessageService.sendAndForget({ command: "setFileList", data: fileList });
    }

    /**
     * Responds to the messages that are waiting for the content to be generated.
     */
    private respondToMessages() {
        this.filters.respondToMessages();

        // pop all the display settings messages and respond to them
        while (this.displaySettingsToRespondTo.length > 0) {
            const respond = this.displaySettingsToRespondTo.pop();
            if (respond) {
                this.logger.info("respondToMessages.displaySettings");
                respond({
                    command: "messageAck",
                    data: undefined,
                });
            }
        }
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
                filename = "core/" + filename;
            } else if (folder?.startsWith("User")) {
                // get the guid from the folder name
                // example User (Primary; 05f3f692-27ba-4a63-a862-cc66a146f3f3)
                // use the first 5 characters of the guid
                const guid = folder.match(GUID_REGEX);
                filename = "user-" + (guid ? guid[0].substring(0, 5) : "") + "/" + filename;
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

        // The previous line is used to check if we have a duplicate log entry.
        let previousLine = "";
        const contentOrNull = content.split("\n").map(line => {
            const truncatedLine = this.truncateLongLines(line);
            const date = this.extractDateFromLogEntry(truncatedLine);
            logEntriesRead++;

            if (line === previousLine) {
                return null;
            }
            previousLine = line;
            return {
                date: date,
                text: `[${this.padZero(logEntriesRead)}]${truncatedLine}`,
                service: serviceName,
            };
        });

        return contentOrNull.filter(entry => entry !== null) as LogEntry[];
    }

    /**
     * Makes sure we don't have really long lines in the log entries.
     * This can be a problem when the Teams logger spews null-character filled lines eventually crashing vscode task host.
     *
     * In reality, we should never have lines longer than 2000 characters, but we'll truncate them just in case.
     * @param line The line to truncate.
     * @returns The truncated line.
     */
    private truncateLongLines(line: string): string {
        if (line.length > 4000) {
            return line.substring(0, 2000) + " ...";
        }
        return line;
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
        // eslint-disable-next-line no-useless-escape
        const isoDateRegex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{6})[\+|-]\d{2}:\d{2}/;

        // matches Sun Jan 07 2024 18:45:43 GMT-0800 (Pacific Standard Time)
        // The date is in the first capture group
        // eslint-disable-next-line no-useless-escape
        const webDateRegexT1 = /(\w{3} \w{3} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[\+|-]\d{4})/;

        // matches 01/04/24 01:31:00.824 AM -08
        // matches 01/04/24 01:31:00.824 AM +08
        // The date is in the first capture group
        // eslint-disable-next-line no-useless-escape
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
                    return entry.isMarker || (this.matchesKeywordFilter(entry.text) && this.matchesLogLevel(entry.text, logLevelRegex) && this.matchesFileFilter(entry.service));
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
        if (this.filters.keywordFilters.length > 0) {
            // Check if the log entry contains any of the keywords
            const keywordRegex = new RegExp(this.filters.keywordFilters.join("|"));
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
        if (this.filters.disabledLogLevels.length === 0) {
            return null;
        }

        const regExToUse: string[] = [];
        for (const levelToRemove of this.filters.disabledLogLevels) {
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
        if (this.filters.timeFilterFromDate && groupTimestamp < this.filters.timeFilterFromDate.getTime()) {
            return false;
        }

        if (this.filters.timeFilterTillDate && groupTimestamp > this.filters.timeFilterTillDate.getTime()) {
            return false;
        }

        return true;
    }

    /**
     * Checks if the given service name should be filtered out based on the file filters.
     * @param serviceName The name of the service to get the file type for.
     * @returns `true` if the log entry should stay, `false` if it should be filtered out.
     */
    private matchesFileFilter(serviceName: string | undefined): boolean {
        // keep markers and entries without a service name
        if (!serviceName) {
            return true;
        }

        const filterState = this.filters.disabledFiles.get(serviceName)?.isEnabled;

        // if the filter is not set, keep the entry
        // if the filter is set, keep the entry if `isEnabled` is true
        // if the filter is set, filter the entry if `isEnabled` is false
        return filterState === undefined || filterState;
    }


    /**
     * Groups the given log entries by second.
     * This assumes that the list of log entries is sorted by date and not filtered.
     * @param logEntries The list of log entries to group by second.
     * @param harLogEntries The list of HAR log entries to group by second.
     * @param token The cancellation token.
     * @returns A map of log entries grouped by second.
     */
    private groupLogEntriesBySecond(
        logEntries: LogEntry[],
        harLogEntries: LogEntry[],
        token: vscode.CancellationToken
    ): Map<number, LogEntry[]> {
        if (this.groupedLogEntries.size > 0) {
            this.logger.info("groupLogEntriesBySecond.cached", undefined, { groupCount: "" + this.groupedLogEntries.size });
            return this.groupedLogEntries;
        }

        this.logger.info("groupLogEntriesBySecond.start", undefined, {
            logEntryCount: "" + logEntries.length,
            harLogEntryCount: "" + harLogEntries.length,
        });

        let allEntries = logEntries.concat(harLogEntries);
        allEntries = allEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
        this.logger.info("groupLogEntriesBySecond.sort", undefined, { combinedLogEntryCount: "" + allEntries.length });

        let currentSecond: Date | null = null;
        let currentGroup = new Array<LogEntry>();
        for (const entry of allEntries) {
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
            const entryText = this.staticStringsToRemove.reduce((text, regex) => text.replaceAll(regex, ""), entry.text);
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

        if (logEntry.service) {
            if (this._displayFileNames) {
                // make sure that the prefix is always the same length
                const fileNamePrefix = logEntry.service.padEnd(this.lengthOfLongestFileName, " ");

                prefix = `[${fileNamePrefix}]`;
            } else {
                prefix = this.substituteFileNames(logEntry.service);
            }
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

    /**
     * Substitutes the file names with emojis.
     * @param service The service name to substitute.
     * @returns The substituted file name.
     */
    private substituteFileNames(service: string): string {
        const fileType = this.getFileTypeFromService(service);
        switch (fileType) {
            case "desktop":
                return "🖥️";
            case "har":
                return "📡";
            case "web":
                return "🌐";
        }
    }

    /**
     * Gets the file type for the given service.
     * @param service The service name to get the file type for.
     * @returns The file type for the service.
     */
    private getFileTypeFromService(service: string): LogFileType {
        switch (service) {
            case "Launcher":
            case "MSTeams":
            case "TeamsNotificationCenter":
            case "TeamsRespawnService":
            case "TeamsSwitcher":
            case "skylib":
            case "tscalling":
                return "desktop";
            case "HAR":
                return "har";
            default:
                return "web";
        }
    }
}

