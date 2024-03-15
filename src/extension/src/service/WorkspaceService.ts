/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { IPostMessageService, PostMessageEventRespondFunction } from "@t200logs/common";
import { WorkspaceFolder, window, workspace } from "vscode";

import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";

import { PostMessageDisposableService } from "./PostMessageDisposableService";

/**
 * Class which manages the state of the currently opened workspace folder.
 */
export class WorkspaceService extends PostMessageDisposableService {
    /**
     * The currently selected workspace folder.
     */
    private _workspaceFolder: WorkspaceFolder | undefined;

    /**
     * Logger instance for the class.
     */
    private readonly logger: ScopedILogger;

    /**
     * Creates a new workspace service.
     * @param logger The logger to use for logging.
     */
    constructor(logger: ITelemetryLogger) {
        super();
        this.logger = logger.createLoggerScope("WorkspaceService");
        this.initializeFolder();
    }

    /**
     * Flag indicating if the workspace is ready.
     * @returns True if the workspace is ready, false otherwise.
     */
    public get hasWorkspace(): boolean {
        return !!this._workspaceFolder;
    }

    /**
     * The currently selected workspace folder.
     * This might be `undefined` if no workspace folder is selected.
     * @returns The currently selected workspace folder.
     */
    public get folder(): WorkspaceFolder | undefined {
        return this._workspaceFolder;
    }

    /**
     * Initializes the workspace service by trying to find the first workspace folder.
     */
    private initializeFolder(): void {
        this.logger.info("initialize");
        const folders = workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            this.logger.info("initialize.found", undefined, {
                folderCount: "" + folders.length,
                selectedFolder: folders[0].uri.fsPath,
                allFolders: folders.map(f => f.uri.fsPath).join(","),
            });
            this._workspaceFolder = folders[0];
            return;
        }

        this.logger.info("initialize.notFound");
    }

    /**
     * Adds a post message service to the workspace service.
     * @param postMessageService The post message service to use for sending messages to the webview.
     */
    public addPostMessageService(postMessageService: IPostMessageService) {
        this.logger.info("addPostMessageService");
        this.setupListeners(postMessageService);

        if (this.hasWorkspace) {
            postMessageService.sendAndForget({ command: "workspaceReady", data: undefined });
        } else {
            postMessageService.sendAndForget({ command: "noWorkspace", data: undefined });
        }
    }

    /**
     * Sets up the listeners for the post message service.
     * We listen for the selectWorkspaceFolder message to let the user choose a workspace folder.
     * @param postMessageService The post message service to use for listening to configuration changes.
     */
    private setupListeners(postMessageService: IPostMessageService) {
        this.logger.info("setupListeners");

        const unregisterWorkspaceSelectionListener = postMessageService.registerMessageHandler(
            "selectWorkspaceFolder",
            (eventType, respond) => this.handleSelectWorkspaceFolder(postMessageService, eventType, respond)
        );
        this.unregisterListeners.push(unregisterWorkspaceSelectionListener);
    }

    /**
     * Handles the selectWorkspaceFolder message event.
     * @param postMessageService The post message service to use for sending messages to the webview.
     * @param eventType The type of workspace folder to select.
     * @param respond The function to call to respond and acknowledge the message.
     */
    private handleSelectWorkspaceFolder(
        postMessageService: IPostMessageService,
        eventType: "any" | "t21",
        respond: PostMessageEventRespondFunction
    ) {
        switch (eventType) {
            case "any":
                void this.chooseAnyWorkspaceFolder(postMessageService);
                break;
            case "t21":
                this.selectT21WorkspaceFolder(postMessageService);
                break;
        }
        respond({ command: "messageAck", data: undefined });
    }

    /**
     * Tries to select the Teams logs workspace folder.
     * @param postMessageService The post message service to use for sending messages to the webview.
     */
    private selectT21WorkspaceFolder(postMessageService: IPostMessageService): void {
        // TODO: Implement this method.
        postMessageService.sendAndForget({ command: "noWorkspace", data: undefined });
    }

    /**
     * Opens a dialog to let the user choose a workspace folder.
     * If the user cancels the dialog, a message is sent to the webview to indicate that no workspace folder was selected.
     * @param postMessageService The post message service to use for sending messages to the webview.
     * @returns Void.
     */
    private async chooseAnyWorkspaceFolder(postMessageService: IPostMessageService): Promise<void> {
        this.logger.info("chooseWorkspaceFolder");

        const folders = await window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: "Select",
            title: "Select the Teams logs",
        });

        if (!folders) {
            this.logger.info("chooseWorkspaceFolder.cancelled");
            postMessageService.sendAndForget({ command: "noWorkspace", data: undefined });
            return undefined;
        }

        const folder = folders[0];
        this._workspaceFolder = workspace.getWorkspaceFolder(folder);
        this.logger.info("chooseWorkspaceFolder.selected", undefined, { folder: folder.fsPath });
        postMessageService.sendAndForget({ command: "workspaceReady", data: undefined });
    }
}
