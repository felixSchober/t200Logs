/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { IPostMessageService, PostMessageEventRespondFunction } from "@t200logs/common";
import { CancellationToken, EventEmitter, FileSystemWatcher, Uri, window as vscodeWindow, workspace } from "vscode";

import { MAX_LOG_FILES_PER_SERVICE } from "../constants/constants";
import { GUID_REGEX } from "../constants/regex";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { throwIfCancellation } from "../utils/throwIfCancellation";

import { PostMessageDisposableService } from "./PostMessageDisposableService";

const MAX_LOG_FILES_RETURNED = 400;

export type ServiceFiles = {
    /**
     * The name of the service.
     */
    serviceName: string;

    /**
     * The files of the service.
     */
    files: Uri[];
};

/**
 * Class which keeps track of files in the current workspace folder and provides the ability to open files.
 */
export class WorkspaceFileService extends PostMessageDisposableService {
    /**
     * A list of log files that are used to render the text content.
     * This list will only be set on the first call to provideTextDocumentContent.
     */
    private logFileCache: Uri[] = [];

    /**
     * A map of log files in the workspace and their corresponding service names.
     * The key is the service name and the value is the list of log files for that service.
     */
    private logFileServiceMap: Map<string, ServiceFiles> = new Map();

    /**
     * The number of characters in the longest file name.
     */
    private _lengthOfLongestFileName = 0;

    /**
     * The number of characters in the longest file name.
     * @returns The number of characters in the longest file name.
     */
    public get lengthOfLongestFileName() {
        return this._lengthOfLongestFileName;
    }

    /**
     * Watcher for the log files in the workspace.
     */
    private readonly watcher: FileSystemWatcher;

    /**
     * Logger instance for the class.
     */
    private readonly logger: ScopedILogger;

    /**
     * Event emitter for file change events.
     */
    private readonly onFileChange: EventEmitter<void> = new EventEmitter();

    public readonly onFileChangeEvent = this.onFileChange.event;

    /**
     * Creates a new workspace file service instance.
     * @param postMessageService The post message service to use for receiving messages to the webview.
     * @param logger The logger to use for logging.
     */
    constructor(
        private readonly postMessageService: IPostMessageService,
        logger: ITelemetryLogger
    ) {
        super();
        this.logger = logger.createLoggerScope("WorkspaceFileService");
        this.watcher = workspace.createFileSystemWatcher("**/*.{log,txt}", false, false, false);

        this.registerFileWatcherEvents();
        this.setupListeners();
    }

    /**
     * Disposes of the workspace file service.
     */
    public override dispose() {
        super.dispose();
        this.watcher.dispose();
    }

    /**
     * Resets the log file cache.
     */
    public reset() {
        this.logFileCache = [];
        this._lengthOfLongestFileName = 0;
        this.logFileServiceMap.clear();
    }

    /**
     * Registers a file watcher for the log files in the workspace so that we can re-fetch the log files and re-generate the content.
     */
    private registerFileWatcherEvents() {
        this.watcher.onDidChange(uri => {
            this.logger.info("registerFileWatcher.onDidChange", undefined, { uri: uri.fsPath });
            this.onFileChange.fire();
        });
        this.watcher.onDidCreate(uri => {
            this.logger.info("registerFileWatcher.onDidCreate", undefined, { uri: uri.fsPath });
            this.onFileChange.fire();
        });
        this.watcher.onDidDelete(uri => {
            this.logger.info("registerFileWatcher.onDidDelete", undefined, { uri: uri.fsPath });
            this.onFileChange.fire();
        });
    }

    /**
     * Generates a list of log files in the workspace or returns the cached list.
     * @param token The cancellation token to use for cancelling the operation.
     * @returns A promise that resolves to a list of log files URIs in the workspace.
     */
    public async generateFileList(token: CancellationToken): Promise<Uri[]> {
        this.logger.info("generateFileList");
        if (this.logFileCache.length > 0) {
            return this.logFileCache;
        }
        this.logFileCache = await workspace.findFiles("**/*.{log,txt}", "**/node_modules/**", MAX_LOG_FILES_RETURNED, token);
        this.logger.info("provideTextDocumentContent.findFiles", undefined, { logFileCount: "" + this.logFileCache.length });
        return this.logFileCache;
    }

    /**
     * Groups the given files by service and sorts them by date.
     * @param files The files to group and sort.
     * @param token The cancellation token.
     * @returns A map of service names to their corresponding {@link ServiceFiles}.
     */
    public groupAndSortFiles(files: Uri[], token: CancellationToken): ServiceFiles[] {
        if (this.logFileServiceMap.size > 0) {
            this.logger.info("groupAndSortFiles.cache", undefined, { logFileServiceMap: "" + this.logFileServiceMap.size });
            return this.sortAndConvertToFlatArray(token);
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

                const serviceFiles = this.logFileServiceMap.get(serviceName);
                if (serviceFiles) {
                    serviceFiles.files.push(file);
                    continue;
                }

                // New service found
                this._lengthOfLongestFileName = Math.max(this._lengthOfLongestFileName, serviceName.length);
                this.logFileServiceMap.set(serviceName, {
                    serviceName,
                    files: [file],
                });
            }
        }

        return this.sortAndConvertToFlatArray();
    }

    /**
     * Sorts the files within each group by date and converts the map to a flat array.
     * @param token The cancellation token.
     * @returns A flat array of {@link ServiceFiles}.
     */
    private sortAndConvertToFlatArray(token?: CancellationToken): ServiceFiles[] {
        // Sort files within each group by date
        const result: ServiceFiles[] = [];
        for (const serviceFiles of this.logFileServiceMap.values()) {
            throwIfCancellation(token);
            // only sort files if there are more than 2 files
            if (serviceFiles.files.length >= MAX_LOG_FILES_PER_SERVICE) {
                serviceFiles.files = serviceFiles.files.sort((a, b) => {
                    const aTimestamp = this.extractTimestampFromFilePath(a.path);
                    const bTimestamp = this.extractTimestampFromFilePath(b.path);
                    return bTimestamp - aTimestamp; // Sort in descending order
                });
            }
            result.push(serviceFiles);
        }

        this.logger.info("groupAndSortFiles.end", undefined, {
            serviceFileCount: "" + result.length,
            lengthOfLongestFileName: "" + this._lengthOfLongestFileName,
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
        // eslint-disable-next-line prefer-const
        let [datePart, timePart] = match ? match[1].split("_") : ["", ""];
        timePart = timePart.replace(/-/g, ":");
        return new Date(`${datePart} ${timePart}`).getTime() || 0;
    }

    /**
     * Sets up the listeners for the post message service.
     * We listen for the selectWorkspaceFolder message to let the user choose a workspace folder.
     */
    private setupListeners() {
        this.logger.info("setupListeners");

        const unregisterFileOpenListener = this.postMessageService.registerMessageHandler(
            "openFile",
            (filePath, respond) => void this.handleFileOpenEvent(filePath, respond)
        );
        this.unregisterListeners.push(unregisterFileOpenListener);
    }

    /**
     * Handles the the request to open a file.
     * @param filePath The file path to open.
     * @param respond The function to call to respond and acknowledge the message.
     */
    private async handleFileOpenEvent(filePath: string, respond: PostMessageEventRespondFunction) {
        this.logger.info("handleFileOpenEvent", undefined, { fileName: filePath });
        try {
            await vscodeWindow.showTextDocument(Uri.file(filePath));
        } catch (error) {
            this.logger.logException("handleFileOpenEvent", error, "Could not open file", { filePath }, true);
        }
        respond({ command: "messageAck", data: undefined });
    }
}
