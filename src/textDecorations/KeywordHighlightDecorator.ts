/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { throwIfCancellation } from "../utils/throwIfCancellation";

export type KeywordHighlight = {
    /**
     * The keyword to highlight.
     */
    keyword: string;

    /**
     * The color to use for highlighting.
     */
    color: string;
};

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
 * Event that is fired the user adds or removes a keyword to highlight.
 */
export type KeywordHighlightChangeEvent = {
    /**
     * Adds a keyword to the list of keywords to highlight.
     */
    addKeyword?: KeywordHighlight;

    /**
     * Removes a keyword from the list of keywords to highlight.
     */
    removeKeyword?: string;
};

/**
 * KeywordHighlightDecorator is responsible for highlighting keywords in the logs viewer.
 */
export class KeywordHighlightDecorator {
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
     * Initializes a new instance of the Keyword highlight decorator class.
     * @param onKeywordHighlightChange The event that is fired when the user adds or removes a keyword to highlight.
     * @param onTextDocumentGenerationFinishedEvent The event that is fired when the text document generation is finished and we can apply the decorations.
     * @param logger The logger.
     */
    constructor(
        onKeywordHighlightChange: vscode.Event<KeywordHighlightChangeEvent>,
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

        onKeywordHighlightChange(event => {
            this.handleKeywordHighlightChange(event);
        });

        this.logger = logger.createLoggerScope("KeywordHighlightDecorator");
    }

    /**
     * Handles the event when the user adds or removes a keyword to highlight.
     * @param event The event that is fired when the user adds or removes a keyword to highlight.
     */
    private handleKeywordHighlightChange(event: KeywordHighlightChangeEvent) {
        this.logger.info("handleKeywordHighlightChange", undefined, { event: JSON.stringify(event) });
        if (event.addKeyword) {
            const highlight: KeywordHighlightWithRegex = {
                ...event.addKeyword,
                // we use the global flag to highlight all occurrences of the keyword
                regex: new RegExp(`${event.addKeyword.keyword}`, "gi"),
            };
            this.keywords.push(highlight);
            void this.applyKeywordDecoration(highlight);
        } else if (event.removeKeyword) {
            this.keywords = this.keywords.filter(k => k.keyword !== event.removeKeyword);
            this.removeKeywordHighlight(event.removeKeyword);
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
            this.logger.logException(
                "removeKeywordHighlight",
                new Error("No decoration found for keyword"),
                "No decoration found for keyword",
                { keyword }
            );
        }
    }

    /**
     * Applies all the keyword decorations to the editor.
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
}


