/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

import { DisplaySettingsChangedEvent, FilterChangedEvent } from "../codeLensProvider/LogContentProvider";

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
     * @param onFilterChangeEvent The event that is fired when the filter changes.
     * @param onDisplaySettingsChangedEvent The event that is fired when the display settings change.
     */
    constructor(
        onFilterChangeEvent: vscode.Event<FilterChangedEvent>,
        onDisplaySettingsChangedEvent: vscode.Event<DisplaySettingsChangedEvent>
    ) {
        this.errorTextDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: "rgba(255, 0, 0, 0.2)",
        });
        this.warnTextDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: "rgba(255, 255, 0, 0.2)",
        });
        this.isoDateTextDecoration = vscode.window.createTextEditorDecorationType({});

        onFilterChangeEvent(() => {
            this.applySeverityLevelHighlighting();
            this.applyReadableIsoDates();
        });

        onDisplaySettingsChangedEvent(() => {
            this.applySeverityLevelHighlighting(true);
            this.applyReadableIsoDates();
        });
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

            this.applySeverityLevelHighlighting(true);
        }
    }

    /**
     * Applies the highlighting of the severity level in the logs viewer.
     * This applies the highlighting to the entire document.
     * To toggle the highlighting, use the {@link toggleSeverityLevelHighlighting} method.
     * @param wasTurnedOn Flag indicating whether the highlighting is being toggled. If true, the method will ignore the current state of the highlighting and apply it anyway. If `false`, the method will only apply the highlighting if it is already applied.
     */
    public applySeverityLevelHighlighting(wasTurnedOn: boolean = false) {
        // apply the highlighting if
        // - the highlighting has not been applied before. Called by the internal toggle method.
        // - the highlighting has been applied before. We need to re-apply it because the filter has been changed.
        if (this.isSeverityLevelHighlightingEnabled || wasTurnedOn) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const text = editor.document.getText();

                // matches all lines that contain either of the following:
                // - ERROR
                // - Err
                // - <ERR>
                const errorRegEx = /.*ERROR.*|.*\sErr\s.*|.*<ERR>.*|\[failure\]/g;

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

                this.isSeverityLevelHighlightingEnabled = true;
            }
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

            this.applyReadableIsoDates(true);
        }
    }

    /**
     * Applies the addition of human-readable dates in the logs viewer.
     * @param wasTurnedOn Flag indicating whether the highlighting is being toggled. If true, the method will ignore the current state of the highlighting and apply it anyway. If `false`, the method will only apply the highlighting if it is already applied.
     */
    public applyReadableIsoDates(wasTurnedOn: boolean = false) {
        if (this.isReadableIsoDatesEnabled || wasTurnedOn) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
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
                this.isReadableIsoDatesEnabled = true;
            }
        }
    }
}















