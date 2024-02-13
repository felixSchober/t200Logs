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

import { LogContentProvider } from "./LogContentProvider";
/**
 * A folding range provider that folds all lines that start with an ISO date.
 */
export class LogFoldingRangeProvider implements FoldingRangeProvider {
    private decorationType: TextEditorDecorationType;

    /**
     * Creates a new instance of the folding range provider.
     */
    constructor() {
        this.decorationType = vscodeWindow.createTextEditorDecorationType({
            color: "transparent", // or the background color to 'hide' the text
        });
    }

    /**
     * Provide folding ranges for the given document.
     * @param document The document for which the folding ranges should be computed.
     * @returns An array of folding ranges or `undefined` if the provider does not want to participate or was cancelled.
     */
    provideFoldingRanges(document: TextDocument): FoldingRange[] {
        const foldingRanges: FoldingRange[] = [];
        // const isDateRegexForHiding = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+\d{2}:\d{2}/;
        const endMarkerRegex = new RegExp(`.*${LogContentProvider.foldingRegionEndMarker}.*`, "g");
        const decorations: DecorationOptions[] = [];
        let startLine = null;

        console.log(`provide folding ranges for ${document.lineCount} lines.`);
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
        console.log(`found ${foldingRanges.length} folding ranges.`);

        // Set the decorations
        const activeEditor = vscodeWindow.activeTextEditor;
        if (activeEditor) {
            activeEditor.setDecorations(this.decorationType, decorations);
        }

        return foldingRanges;
    }
}

