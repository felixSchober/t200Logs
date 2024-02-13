/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

import { DisplaySettingsChangedEvent } from "../codeLensProvider/LogContentProvider";
import { ERROR_REGEX, WARN_REGEX, WEB_DATE_REGEX_GLOBAL } from "../constants/regex";

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
     * @param onWebviewDisplaySettingsChangedEvent The event that is fired when the display settings change through the webview.
     * @param onTextDocumentGenerationFinishedEvent The event that is fired when the text document generation is finished and we can apply the decorations.
     */
    constructor(
        onWebviewDisplaySettingsChangedEvent: vscode.Event<DisplaySettingsChangedEvent>,
        onTextDocumentGenerationFinishedEvent: vscode.Event<string>
    ) {
        this.errorTextDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: "rgba(255, 0, 0, 0.2)",
        });
        this.warnTextDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: "rgba(255, 255, 0, 0.2)",
        });
        this.isoDateTextDecoration = vscode.window.createTextEditorDecorationType({});

        onTextDocumentGenerationFinishedEvent((newContent: string) => {
            // we have to wait for vscode to be ready before we can apply the decorations
            setTimeout(() => {
                this.applySeverityLevelHighlighting(newContent);
                this.applyReadableIsoDates(newContent);
            }, 2000);
        });

        onWebviewDisplaySettingsChangedEvent(() => {
            this.applySeverityLevelHighlighting(null);
            this.applyReadableIsoDates(null);
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

            this.applySeverityLevelHighlighting(null, true);
        }
    }

    /**
     * Applies the highlighting of the severity level in the logs viewer.
     * This applies the highlighting to the entire document.
     * To toggle the highlighting, use the {@link toggleSeverityLevelHighlighting} method.
     * @param content New content to apply the decoration to. If `null` the method will take the content from the active text editor. (This is useful because after filtering the content read by the vscode API will not yet be updated.).
     * @param wasTurnedOn Flag indicating whether the highlighting is being toggled. If true, the method will ignore the current state of the highlighting and apply it anyway. If `false`, the method will only apply the highlighting if it is already applied.
     */
    public applySeverityLevelHighlighting(content: string | null, wasTurnedOn: boolean = false) {
        // apply the highlighting if
        // - the highlighting has not been applied before. Called by the internal toggle method.
        // - the highlighting has been applied before. We need to re-apply it because the filter has been changed.

        console.log(
            "[TextDecorator] Applying severity level highlighting. Was turned on:",
            wasTurnedOn,
            "Current state:",
            this.isSeverityLevelHighlightingEnabled
        );
        if (this.isSeverityLevelHighlightingEnabled || wasTurnedOn) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const text = content ?? editor.document.getText();
                console.log("[TextDecorator] Applying severity level highlighting to the entire document. Document length:", text.length);

                const errorDecorationsArray: vscode.DecorationOptions[] = [];
                const warnDecorationsArray: vscode.DecorationOptions[] = [];

                void vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: "Applying severity level highlighting...",
                    },
                    async () => {
                        const errorDecorationPromise = new Promise<vscode.DecorationOptions[]>(resolve => {
                            let match;
                            while ((match = ERROR_REGEX.exec(text))) {
                                const startPos = editor.document.positionAt(match.index);
                                const endPos = editor.document.positionAt(match.index + match[0].length);

                                const decoration = {
                                    range: new vscode.Range(startPos, endPos),
                                };

                                errorDecorationsArray.push(decoration);
                            }
                            resolve(errorDecorationsArray);
                        });

                        const warnDecorationPromise = new Promise<vscode.DecorationOptions[]>(resolve => {
                            let match;
                            while ((match = WARN_REGEX.exec(text))) {
                                const startPos = editor.document.positionAt(match.index);
                                const endPos = editor.document.positionAt(match.index + match[0].length);

                                const decoration = {
                                    range: new vscode.Range(startPos, endPos),
                                };

                                warnDecorationsArray.push(decoration);
                            }
                            resolve(warnDecorationsArray);
                        });

                        // Run the promises in parallel and then set the decorations
                        const [errors, warnings] = await Promise.all([errorDecorationPromise, warnDecorationPromise]);
                        editor.setDecorations(this.errorTextDecoration, errors);
                        editor.setDecorations(this.warnTextDecoration, warnings);

                        this.isSeverityLevelHighlightingEnabled = true;
                        console.log(
                            `[TextDecorator] Finished applying severity level highlighting. Found ${errors.length} errors and ${warnings.length} warnings.`
                        );
                    }
                );
            } else {
                console.error("[TextDecorator] No active text editor for text decoration.");
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

            this.applyReadableIsoDates(null, true);
        }
    }

    /**
     * Applies the addition of human-readable dates in the logs viewer.
     * @param content New content to apply the decoration to. If `null` the method will take the content from the active text editor. (This is useful because after filtering the content read by the vscode API will not yet be updated.).
     * @param wasTurnedOn Flag indicating whether the highlighting is being toggled. If true, the method will ignore the current state of the highlighting and apply it anyway. If `false`, the method will only apply the highlighting if it is already applied.
     */
    public applyReadableIsoDates(content: string | null, wasTurnedOn: boolean = false) {
        console.log(
            "[TextDecorator] Applying readable ISO dates. Was turned on:",
            wasTurnedOn,
            "Current state:",
            this.isReadableIsoDatesEnabled
        );
        if (this.isReadableIsoDatesEnabled || wasTurnedOn) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const text = content ?? editor.document.getText();
                const decorationsArray: vscode.DecorationOptions[] = [];

                let match;
                while ((match = WEB_DATE_REGEX_GLOBAL.exec(text))) {
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
            } else {
                console.error("[TextDecorator] No active text editor for text decoration.");
            }
        }
    }
}





































