/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { IPostMessageService } from "@t200logs/common";
import * as vscode from "vscode";

import { LogContentProvider } from "../providers/content/LogContentProvider";
import { PostMessageDisposableService } from "../service/PostMessageDisposableService";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { getEditor } from "../utils/getEditor";

type RangeChangedEventData = {
    /**
     * The midpoint of the visible range. This is used to determine the line to scroll to when the user clicks on a log entry.
     */
    midpoint: number;
};

/**
 * Manages the visible ranges of the active text editor and fires an event when the visible range changes.
 */
export class DocumentLocationManager extends PostMessageDisposableService {
    private lastVisibleRanges: vscode.Range[] = [];

    private rangeUpdateEvent: vscode.Disposable | null;

    private readonly logger: ScopedILogger;

    public onRangeChanged = new vscode.EventEmitter<RangeChangedEventData>();

    /**
     * Creates a new instance of the DocumentLocationManager class.
     * @param logger The logger to use for the class.
     */
    constructor(logger: ITelemetryLogger) {
        super();
        this.logger = logger.createLoggerScope("DocumentLocationManager");
        this.rangeUpdateEvent = vscode.window.onDidChangeTextEditorVisibleRanges(this.updateRanges, this);
    }

    /**
     * Adds a post message service to the document location manager so that it can listen for post messages.
     * @param postMessageService The post message service to add.
     */
    public addPostMessageService(postMessageService: IPostMessageService) {
        const unregisterHandler = postMessageService.registerMessageHandler("jumpToRow", (rowToJumpTo, respond) => {
            this.logger.info("jumpToRow", undefined, { row: "" + rowToJumpTo });
            void this.setCursor(rowToJumpTo);
            respond({ command: "messageAck", data: undefined });
        });
        this.unregisterListeners.push(unregisterHandler);
    }

    /**
     * Disposes of the object.
     */
    public override dispose() {
        this.logger.info("dispose");
        super.dispose();
        if (this.rangeUpdateEvent) {
            this.rangeUpdateEvent.dispose();
            this.rangeUpdateEvent = null;
        }
    }

    /**
     * Updates the visible ranges of the active text editor by comparing the current visible ranges with the last visible ranges.
     * @param e The text editor visible ranges change event.
     */
    private updateRanges(e: vscode.TextEditorVisibleRangesChangeEvent) {
        // make sure we're only updating ranges for document created by the LogContentProvider
        const expectedUri = LogContentProvider.documentUri;
        if (e.textEditor.document.uri.path !== expectedUri.path) {
            return;
        }

        const currentVisibleRanges = e.visibleRanges;
        if (currentVisibleRanges.length === 0) {
            return;
        }

        // compare the current visible ranges with the last visible ranges
        if (
            this.lastVisibleRanges[0]?.start.line === currentVisibleRanges[0].start.line &&
            this.lastVisibleRanges[0]?.end.line === currentVisibleRanges[0].end.line
        ) {
            return;
        }

        this.lastVisibleRanges = [...currentVisibleRanges];
        const midpoint = Math.floor((currentVisibleRanges[0].start.line + currentVisibleRanges[0].end.line) / 2);
        this.onRangeChanged.fire({ midpoint });
    }

    /**
     * Forces the log content provider to open and returns the text editor for the log content provider.
     * @returns The text editor for the log content provider.
     */
    public async forceLogContentProviderToOpen(): Promise<vscode.TextEditor> {
        this.logger.info("forceLogContentProviderToOpen");
        const doc = await vscode.workspace.openTextDocument(LogContentProvider.documentUri);
        return await vscode.window.showTextDocument(doc, { preview: false });
    }

    /**
     * Sets the cursor to the specified midpoint.
     * @param midpoint The midpoint of the visible range. This is used to determine the line to scroll to when the user clicks on a log entry.
     */
    public async setCursor(midpoint: number) {
        // find the correct editor
        let editor = getEditor();

        if (!editor) {
            this.logger.info("setCursor.noEditorFound", undefined, { midpoint: "" + midpoint });
            editor = await this.forceLogContentProviderToOpen();

            if (!editor) {
                this.logger.logException(
                    "setCursor.noEditorFound.forceOpen",
                    new Error("Could not open log document to set cursor position"),
                    "Could not open log document to set cursor position",
                    { midpoint: "" + midpoint },
                    true,
                    "Jump to location"
                );
                return;
            }
        }

        this.logger.info("setCursor", undefined, { midpoint: "" + midpoint });

        const position = new vscode.Position(midpoint, 0);
        const range = editor.document.lineAt(midpoint - 1).range;
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    }
}
