/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

/**
 * TextDecorator is a class that provides the ability to decorate in the logs viewer.
 */
export class TextDecorator {
    /**
     * Flag indicating whether the severity level highlighting is enabled.
     */
    private isSeverityLevelHighlightingEnabled: boolean = false;

    /**
     * Flag indicating whether the readable ISO dates are enabled.
     */
    private isReadableIsoDatesEnabled: boolean = false;

    private readonly errorTextDecoration: vscode.TextEditorDecorationType;

    private readonly warnTextDecoration: vscode.TextEditorDecorationType;

    private readonly isoDateTextDecoration: vscode.TextEditorDecorationType;

    /**
     * Initializes a new instance of the TextDecorator class.
     */
    constructor() {
        this.errorTextDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: "rgba(255, 0, 0, 0.2)",
        });
        this.warnTextDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: "rgba(255, 255, 0, 0.2)",
        });
        this.isoDateTextDecoration = vscode.window.createTextEditorDecorationType({});
    }

    /**
     * Toggles the highlighting of the severity level in the logs viewer.
     */
    public toggleSeverityLevelHighlighting() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            // we don't need to search for matches if we're disabling the highlighting
            if (this.isSeverityLevelHighlightingEnabled) {
                editor.setDecorations(this.errorTextDecoration, []);
                editor.setDecorations(this.warnTextDecoration, []);
                this.isSeverityLevelHighlightingEnabled = false;
                return;
            }

            const text = editor.document.getText();

            // matches all lines that contain either of the following:
            // - ERROR
            // - Err
            // - <ERR>
            const errorRegEx = /.*ERROR.*|.*\sErr\s.*|.*<ERR>.*/g;

            // matches all lines that contain either of the following:
            // - WARN
            // - Warn
            // - War
            // - <WARN>
            const warnRegEx = /.*\sWARN\s.*|.*\sWarn\s.*|.*\sWar\s.*|.*<WARN>.*/g;

            const errorDecorationsArray: vscode.DecorationOptions[] = [];
            const warnDecorationsArray: vscode.DecorationOptions[] = [];

            let match;
            while ((match = errorRegEx.exec(text))) {
                const startPos = editor.document.positionAt(match.index);
                const endPos = editor.document.positionAt(match.index + match[0].length);

                const decoration = {
                    range: new vscode.Range(startPos, endPos),
                };

                errorDecorationsArray.push(decoration);
            }

            while ((match = warnRegEx.exec(text))) {
                const startPos = editor.document.positionAt(match.index);
                const endPos = editor.document.positionAt(match.index + match[0].length);

                const decoration = {
                    range: new vscode.Range(startPos, endPos),
                };

                warnDecorationsArray.push(decoration);
            }

            editor.setDecorations(this.errorTextDecoration, errorDecorationsArray);
            editor.setDecorations(this.warnTextDecoration, warnDecorationsArray);

            this.isSeverityLevelHighlightingEnabled = !this.isSeverityLevelHighlightingEnabled;
        }
    }

    /**
     * Toggles the addition of human-readable dates in the logs viewer.
     */
    public toggleReadableIsoDates() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            // we don't need to search for matches if we're disabling the highlighting
            if (this.isReadableIsoDatesEnabled) {
                editor.setDecorations(this.isoDateTextDecoration, []);
                this.isReadableIsoDatesEnabled = false;
                return;
            }

            const text = editor.document.getText();
            const isoDateRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g;
            const decorationsArray: vscode.DecorationOptions[] = [];

            let match;
            while ((match = isoDateRegex.exec(text))) {
                const date = new Date(match[0]);
                const humanReadableDate = date.toLocaleString(); // Convert to a human-readable format

                const startPos = editor.document.positionAt(match.index);
                const endPos = editor.document.positionAt(match.index + match[0].length);

                const decoration = {
                    range: new vscode.Range(startPos, endPos),
                    renderOptions: {
                        after: {
                            contentText: this.isReadableIsoDatesEnabled ? "" : ` [${humanReadableDate} UTC]`,
                            color: "lightgrey", // You can adjust the color
                            fontWeight: "bold",
                            textDecoration: "none;",
                        },
                    },
                };

                decorationsArray.push(decoration);
            }
            editor.setDecorations(this.isoDateTextDecoration, decorationsArray);
            this.isReadableIsoDatesEnabled = !this.isReadableIsoDatesEnabled;
        }
    }
}

