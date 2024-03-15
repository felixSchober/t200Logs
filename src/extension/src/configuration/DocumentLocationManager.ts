/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

import { LogContentProvider } from "../providers/content/LogContentProvider";
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
export class DocumentLocationManager implements vscode.Disposable {
    private lastVisibleRanges: vscode.Range[] = [];

    private rangeUpdateEvent: vscode.Disposable | null;

    private readonly logger: ScopedILogger;

    public onRangeChanged = new vscode.EventEmitter<RangeChangedEventData>();

    /**
     * Creates a new instance of the DocumentLocationManager class.
     * @param logger The logger to use for the class.
     */
    constructor(logger: ITelemetryLogger) {
        this.logger = logger.createLoggerScope("DocumentLocationManager");
        this.rangeUpdateEvent = vscode.window.onDidChangeTextEditorVisibleRanges(this.updateRanges, this);
    }

    /**
     * Disposes of the object.
     */
    dispose() {
        this.logger.info("dispose");
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
     * Sets the cursor to the specified midpoint.
     * @param midpoint The midpoint of the visible range. This is used to determine the line to scroll to when the user clicks on a log entry.
     */
    public setCursor(midpoint: number) {
        // find the correct editor
        const editor = getEditor();
        if (editor) {
            this.logger.info("setCursor", undefined, { midpoint: "" + midpoint });

            const position = new vscode.Position(midpoint, 0);
            editor.selection = new vscode.Selection(position, position);
        } else {
            this.logger.info("setCursor.noEditorFound", undefined, { midpoint: "" + midpoint });
        }
    }
}
