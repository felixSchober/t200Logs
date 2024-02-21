/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { throwIfCancellation } from "../utils/throwIfCancellation";
import type { IPostMessageService, KeywordHighlight, KeywordHighlightChangeEvent, PostMessageEventRespondFunction } from "@t200logs/common";
import { ConfigurationManager } from "../configuration/ConfigurationManager";

/**
 * Internal representation of a keyword to highlight with a regular expression.
 */
type KeywordHighlightWithRegex = KeywordHighlight & {
    /**
     * The regular expression to use for highlighting.
     */
    regex: RegExp;
};

/**
 * KeywordHighlightDecorator is responsible for highlighting keywords in the logs viewer.
 */
export class KeywordHighlightDecorator implements vscode.Disposable {
    /**
     * List of keywords to highlight.
     */
    private keywords: KeywordHighlightWithRegex[] = [];

    /**
     * A map of decorations for each keyword.
     */
    private decorations: Record<string, vscode.TextEditorDecorationType> = {};

    /**
     * Logger for the KeywordHighlightDecorator.
     */
    private readonly logger: ScopedILogger;

    /**
     * List of handler registrations that need to be disposed when the decorator is disposed.
     */
    private readonly handlerRegistrations: (() => void)[] = [];

    /**
     * A list of functions that should be called after {@link applyAllKeywordDecorations} is finished.
     */
    private readonly filterMessagesToRespondTo: PostMessageEventRespondFunction[] = [];

    /**
     * Initializes a new instance of the Keyword highlight decorator class.
     * @param postMessageService The post message service.
     * @param onTextDocumentGenerationFinishedEvent The event that is fired when the text document generation is finished and we can apply the decorations.
     * @param logger The logger.
     */
    constructor(
        private readonly postMessageService: IPostMessageService,
        private readonly configurationManager: ConfigurationManager,
        onTextDocumentGenerationFinishedEvent: vscode.Event<string>,
        logger: ITelemetryLogger
    ) {
        onTextDocumentGenerationFinishedEvent((newContent: string) => {
            this.logger.info("onTextDocumentGenerationFinishedEvent", undefined, {
                newContentLength: "" + newContent.length,
                keywords: this.keywords.map(k => k.keyword).join(", "),
            });
            // we have to wait for vscode to be ready before we can apply the decorations
            setTimeout(() => {
                void this.applyAllKeywordDecorations(newContent);
            }, 1000);
        });

        const keywordHighlightChangeHandler = postMessageService.registerMessageHandler("keywordHighlightStateChange", (event, respond) => {
            this.handleKeywordHighlightChange(event, respond);
        });
        this.handlerRegistrations.push(keywordHighlightChangeHandler);
        this.logger = logger.createLoggerScope("KeywordHighlightDecorator");
        this.setupKeywordHighlightsFromConfiguration();
    }

    private setupKeywordHighlightsFromConfiguration() {
        const keywordHighlights = this.configurationManager.keywordHighlights;
        this.logger.info("setupKeywordHighlightsFromConfiguration", undefined, {
            keywordHighlights: keywordHighlights.map(kw => `{[${kw.isChecked ? "X" : "-"}] ${kw.keyword} - ${kw.color}}`).join(", "),
        });
        for (const keyword of keywordHighlights.filter(kw => kw.isChecked)) {
            this.keywords.push({
                ...keyword,
                regex: new RegExp(`${keyword.keyword}`, "gi"),
            });
        }
        this.postMessageService.sendAndForget({ command: "updateNumberOfHighlightedKeywords", data: this.keywords.length });
        this.postMessageService.sendAndForget({
            command: "setKeywordHighlightsFromConfiguration",
            data: keywordHighlights.map(kw => {
                return {
                    keywordDefinition: {
                        keyword: kw.keyword,
                        color: kw.color,
                    },
                    isChecked: kw.isChecked,
                };
            }),
        });
    }

    dispose() {
        this.logger.info("dispose");
        for (const dispose of this.handlerRegistrations) {
            dispose();
        }
        for (const keyword of this.keywords) {
            this.removeKeywordHighlight(keyword.keyword);
        }
    }

    /**
     * Handles the event when the user adds or removes a keyword to highlight.
     * @param event The event that is fired when the user adds or removes a keyword to highlight.
     */
    private handleKeywordHighlightChange(event: KeywordHighlightChangeEvent, respond: PostMessageEventRespondFunction) {
        this.logger.info("handleKeywordHighlightChange", undefined, { event: JSON.stringify(event) });
        if (event.isChecked) {
            const highlight: KeywordHighlightWithRegex = {
                ...event.keywordDefinition,
                // we use the global flag to highlight all occurrences of the keyword
                regex: new RegExp(`${event.keywordDefinition.keyword}`, "gi"),
            };
            this.keywords.push(highlight);
            void this.applyKeywordDecoration(highlight, undefined, undefined, () => {
                this.logger.info("handleKeywordHighlightChange.applyKeywordDecoration.finished", undefined, { keyword: highlight.keyword });
                this.acknowledgeMessage();
                this.updateNumberOfActiveKeywords();
            });
        } else {
            this.keywords = this.keywords.filter(k => k.keyword !== event.keywordDefinition.keyword);
            this.removeKeywordHighlight(event.keywordDefinition.keyword);
        }
        this.filterMessagesToRespondTo.push(respond);
    }

    private acknowledgeMessage() {
        while (this.filterMessagesToRespondTo.length > 0) {
            const respond = this.filterMessagesToRespondTo.pop();
            if (respond) {
                respond({
                    command: "messageAck",
                    data: undefined,
                });
            }
        }
    }

    /**
     * Removes a highlighted keyword from the editor and disposes the decoration.
     * @param keyword The keyword to remove.
     */
    private removeKeywordHighlight(keyword: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.logger.logException("removeKeywordHighlight", new Error("No active text editor"), "No active text editor");
            return;
        }

        const keywordDecoration = this.decorations[keyword];
        if (keywordDecoration) {
            editor.setDecorations(keywordDecoration, []);
            keywordDecoration.dispose();
            delete this.decorations[keyword];
            this.logger.info("removeKeywordHighlight", undefined, { keyword });
        } else {
            this.logger.info("removeKeywordHighlight.noChange", undefined, { keyword });
        }
        this.acknowledgeMessage();
        this.updateNumberOfActiveKeywords();
    }

    /**
     * Applies all the keyword decorations to the editor.
     * This is only executed once when the text document generation is finished.
     * New keywords are added to the list and {@link applyKeywordDecoration} is called.
     * @param content The document content to apply the decoration to. If `null` the method will take the content from the active text editor. (This is useful because after filtering the content read by the vscode API will not yet be updated.).
     */
    private async applyAllKeywordDecorations(content?: string) {
        if (this.keywords.length === 0) {
            this.logger.info("applyAllKeywordDecorations.noKeywords");
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.logger.logException("applyAllKeywordDecorations", new Error("No active text editor"), "No active text editor");
            return;
        }

        content = content || editor.document.getText();
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Applying Keyword Highlighting",
                cancellable: true,
            },
            async (progress, token) => {
                // Create a custom progress reporter that will report progress for each keyword once they are finished.
                const keywordsToApply = this.keywords.length;
                const progressIncrementPerKeyword = 100 / keywordsToApply;
                const onUpdateProgressFinished = () => {
                    progress.report({ increment: progressIncrementPerKeyword });
                };

                const promises = this.keywords.map(keyword => {
                    return this.applyKeywordDecoration(keyword, content, token, onUpdateProgressFinished);
                });

                await Promise.all(promises);
                this.logger.info("applyAllKeywordDecorations.finished");
            }
        );
    }

    /**
     * Applies a single highlighted keyword to the editor.
     * @param keyword The keyword to highlight.
     * @param content The document content to apply the decoration to.
     * @param token The cancellation token.
     * @param onUpdateProgressFinished The callback to call when applying the decoration is finished.
     * @returns A promise that resolves when the decoration has been applied.
     */
    private async applyKeywordDecoration(
        keyword: KeywordHighlightWithRegex,
        content?: string,
        token?: vscode.CancellationToken,
        onUpdateProgressFinished?: () => void
    ) {
        this.logger.info("applyKeywordDecoration", undefined, {
            keyword: keyword.keyword,
            color: keyword.color,
            keywordRegex: keyword.regex.source,
        });

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.logger.logException("applyKeywordDecoration", new Error("No active text editor"), "No active text editor");
            return;
        }

        let textContent: string;
        if (!content) {
            this.logger.info("applyKeywordDecoration.getContentFromEditor", undefined, { keyword: keyword.keyword });
            textContent = editor.document.getText();
        } else {
            textContent = content;
        }

        let decorationToApply = this.decorations[keyword.keyword];
        if (!decorationToApply) {
            decorationToApply = vscode.window.createTextEditorDecorationType({
                backgroundColor: keyword.color,
            });
            this.decorations[keyword.keyword] = decorationToApply;
        }

        const decorations = await new Promise<vscode.DecorationOptions[]>(resolve => {
            let match;
            const decorationsArray: vscode.DecorationOptions[] = [];
            while ((match = keyword.regex.exec(textContent))) {
                throwIfCancellation(token);
                const startPos = editor.document.positionAt(match.index);
                const endPos = editor.document.positionAt(match.index + match[0].length);

                const decoration = {
                    range: new vscode.Range(startPos, endPos),
                };

                decorationsArray.push(decoration);
            }
            this.logger.info(`applyKeywordDecoration.apply.${keyword.keyword}`, undefined, {
                highlights: "" + decorationsArray.length,
            });
            resolve(decorationsArray);
        });

        editor.setDecorations(decorationToApply, decorations);
        onUpdateProgressFinished?.();
        this.logger.info(`applyKeywordDecoration.setDecorations.${keyword.keyword}.success`);
    }

    private updateNumberOfActiveKeywords() {
        this.postMessageService.sendAndForget({ command: "updateNumberOfHighlightedKeywords", data: this.keywords.length });
    }
}





















