/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

import { ERROR_REGEX, WARN_REGEX, WEB_DATE_REGEX_GLOBAL } from "../constants/regex";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import type { IPostMessageService, PostMessageEventRespondFunction } from "@t200logs/common";

/**
 * TextDecorator is a class that provides the ability to decorate in the logs viewer.
 */
export class TextDecorator implements vscode.Disposable {
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

    private readonly unregisterPostMessageEvent: () => void;

    private readonly postMessageEventToRespondTo: PostMessageEventRespondFunction[] = [];

    private readonly logger: ScopedILogger;

    /**
     * Initializes a new instance of the TextDecorator class.
     * @param onWebviewDisplaySettingsChangedEvent The event that is fired when the display settings change through the webview.
     * @param onTextDocumentGenerationFinishedEvent The event that is fired when the text document generation is finished and we can apply the decorations.
     * @param logger The logger.
     */
    constructor(
        postMessageService: IPostMessageService,
        onTextDocumentGenerationFinishedEvent: vscode.Event<string>,
        logger: ITelemetryLogger
    ) {
        this.errorTextDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: "rgba(255, 0, 0, 0.2)",
        });
        this.warnTextDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: "rgba(255, 255, 0, 0.2)",
        });
        this.isoDateTextDecoration = vscode.window.createTextEditorDecorationType({});

        onTextDocumentGenerationFinishedEvent((newContent: string) => {
            this.logger.info("onTextDocumentGenerationFinishedEvent", undefined, { newContentLength: "" + newContent.length });
            // we have to wait for vscode to be ready before we can apply the decorations
            setTimeout(() => {
                this.applySeverityLevelHighlighting(newContent);
                this.applyReadableIsoDates(newContent);
            }, 2000);
        });

        this.unregisterPostMessageEvent = postMessageService.registerMessageHandler("displaySettingsChanged", (event, respond) => {
            let shouldAcknowledge = false;
            if (event.displayReadableDates !== null && this.isReadableIsoDatesEnabled !== event.displayReadableDates) {
                this.logger.info("displaySettingsChanged.displayReadableDates", undefined, { newState: "" + event.displayReadableDates });
                this.applyReadableIsoDates(null, event.displayReadableDates);
                shouldAcknowledge = true;
            }

            if (event.displayLogLevels !== null && this.isSeverityLevelHighlightingEnabled !== event.displayLogLevels) {
                this.logger.info("displaySettingsChanged.displayLogLevels", undefined, { newState: "" + event.displayLogLevels });
                this.applySeverityLevelHighlighting(null, event.displayLogLevels);
                shouldAcknowledge = true;
            }

            if (shouldAcknowledge) {
                this.postMessageEventToRespondTo.push(respond);
            }
        });

        this.logger = logger.createLoggerScope("TextDecorator");
    }
    dispose() {
        if (this.unregisterPostMessageEvent) {
            this.unregisterPostMessageEvent();
        }
    }

    /**
     * Toggles the highlighting of the severity level in the logs viewer.
     */
    public toggleSeverityLevelHighlighting() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this.logger.info("toggleSeverityLevelHighlighting");
            // we don't need to search for matches if we're disabling the highlighting
            if (this.isSeverityLevelHighlightingEnabled) {
                editor.setDecorations(this.errorTextDecoration, []);
                editor.setDecorations(this.warnTextDecoration, []);
                this.isSeverityLevelHighlightingEnabled = false;
                return;
            }

            this.applySeverityLevelHighlighting(null, true);
        } else {
            this.logger.logException(
                "toggleSeverityLevelHighlighting",
                new Error("No active text editor"),
                "No active text editor",
                undefined,
                true,
                "Severity level highlighting"
            );
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

        this.logger.info("applySeverityLevelHighlighting", undefined, {
            wasTurnedOn: "" + wasTurnedOn,
            currentState: "" + this.isSeverityLevelHighlightingEnabled,
        });
        if (this.isSeverityLevelHighlightingEnabled || wasTurnedOn) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const text = content ?? editor.document.getText();
                this.logger.info("applySeverityLevelHighlighting.apply.start", undefined, { documentLength: "" + text.length });

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
                            this.logger.info("applySeverityLevelHighlighting.apply.errorDecorationPromise", undefined, {
                                errorDecorationsArrayLength: "" + errorDecorationsArray.length,
                            });
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
                            this.logger.info("applySeverityLevelHighlighting.apply.warnDecorationPromise", undefined, {
                                warnDecorationsArrayLength: "" + warnDecorationsArray.length,
                            });
                            resolve(warnDecorationsArray);
                        });

                        // Run the promises in parallel and then set the decorations
                        const [errors, warnings] = await Promise.all([errorDecorationPromise, warnDecorationPromise]);
                        editor.setDecorations(this.errorTextDecoration, errors);
                        editor.setDecorations(this.warnTextDecoration, warnings);

                        // respond to the post message events
                        while (this.postMessageEventToRespondTo.length > 0) {
                            const respond = this.postMessageEventToRespondTo.pop();
                            respond?.({
                                command: "messageAck",
                                data: undefined,
                            });
                        }

                        this.isSeverityLevelHighlightingEnabled = true;
                        this.logger.info("applySeverityLevelHighlighting.apply.end", undefined, {
                            errorsLength: "" + errors.length,
                            warningsLength: "" + warnings.length,
                        });
                    }
                );
            } else {
                this.logger.logException(
                    "applySeverityLevelHighlighting",
                    new Error("No active text editor"),
                    "No active text editor",
                    undefined,
                    true,
                    "Severity level highlighting"
                );
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
        this.logger.info("applyReadableIsoDates", undefined, {
            wasTurnedOn: "" + wasTurnedOn,
            currentState: "" + this.isReadableIsoDatesEnabled,
        });
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
                this.logger.logException(
                    "applyReadableIsoDates",
                    new Error("No active text editor"),
                    "No active text editor",
                    undefined,
                    true,
                    "Readable ISO dates"
                );
            }
        }
    }
}






