/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import {
    DecorationOptions,
    FoldingRange,
    FoldingRangeProvider,
    TextDocument,
    TextEditorDecorationType,
    window as vscodeWindow,
} from "vscode";

import { WEB_DATE_REGEX } from "../constants/regex";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { getEditor } from "../utils/getEditor";

import { LogContentProvider } from "./content/LogContentProvider";

/**
 * A folding range provider that folds all lines that start with an ISO date.
 */
export class LogFoldingRangeProvider implements FoldingRangeProvider {
    private readonly decorationType: TextEditorDecorationType;
    private readonly logger: ScopedILogger;

    /**
     * Creates a new instance of the folding range provider.
     * @param logger The logger.
     */
    constructor(logger: ITelemetryLogger) {
        this.decorationType = vscodeWindow.createTextEditorDecorationType({
            color: "transparent", // or the background color to 'hide' the text
        });
        this.logger = logger.createLoggerScope("LogFoldingRangeProvider");
    }

    /**
     * Provide folding ranges for the given document.
     * @param document The document for which the folding ranges should be computed.
     * @returns An array of folding ranges or `undefined` if the provider does not want to participate or was cancelled.
     */
    provideFoldingRanges(document: TextDocument): FoldingRange[] {
        const foldingRanges: FoldingRange[] = [];

        const endMarkerRegex = new RegExp(`.*${LogContentProvider.foldingRegionEndMarker}.*`, "g");
        const decorations: DecorationOptions[] = [];
        let startLine = null;

        this.logger.info("provideFoldingRanges.start", undefined, { documentLineCount: "" + document.lineCount });
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            const startRegionMatch = lineText.match(WEB_DATE_REGEX);
            const endRegionMatch = lineText.match(endMarkerRegex);

            if (startRegionMatch) {
                startLine = i;
            }

            if (endRegionMatch) {
                if (startLine !== null) {
                    foldingRanges.push(new FoldingRange(startLine, i));
                    startLine = null;
                }
            }
        }
        this.logger.info("provideFoldingRanges.end", undefined, { foldingRangesCount: "" + foldingRanges.length });

        // Set the decorations
        const activeEditor = getEditor();
        if (activeEditor) {
            activeEditor.setDecorations(this.decorationType, decorations);
        } else {
            this.logger.logException("provideFoldingRanges", new Error("No active editor"));
        }

        return foldingRanges;
    }
}
