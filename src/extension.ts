/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/* eslint-disable max-classes-per-file */
import * as fs from "fs";
import * as path from "path";

import * as vscode from "vscode";

import { GoToSourceLensProvider } from "./codeLensProvider/GoToSourceLensProvider";
import {
    DisplaySettingsChangedEvent,
    FilterChangedEvent,
    FilterKeywordChangedEvent,
    LogContentProvider,
} from "./codeLensProvider/LogContentProvider";

/**
 * Activate the extension.
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "t200logs" is now active!');
    const onFilterChanged = new vscode.EventEmitter<FilterChangedEvent>();
    const onDisplaySettingsChanged = new vscode.EventEmitter<DisplaySettingsChangedEvent>();
    const provider = new LogContentProvider(onFilterChanged.event, onDisplaySettingsChanged.event);
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(LogContentProvider.documentScheme, provider));

    let codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { scheme: "file", pattern: "**/desktop/**" },
        new GoToSourceLensProvider()
    );

    let disposableDecoration = vscode.commands.registerCommand("t200logs.hideIsoDates", () => {
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
                            contentText: ` [${humanReadableDate}]`,
                            color: "lightgrey", // You can adjust the color
                            fontWeight: "bold",
                            textDecoration: "none;",
                        },
                    },
                };

                decorationsArray.push(decoration);
            }

            // const decorationType = vscode.window.createTextEditorDecorationType({});
            // editor.setDecorations(decorationType, decorationsArray);
        }
    });

    console.log("T200Logs extension activated");

    const foldingProvider = new LogFoldingRangeProvider();
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            { scheme: "file", language: "log" }, // Adjust the language if necessary
            foldingProvider
        )
    );

    context.subscriptions.push(codeLensDisposable);
    context.subscriptions.push(disposableDecoration);

    // Add a command to open the virtual document
    let openLogViewerDisposable = vscode.commands.registerCommand("t200logs.openLogViewer", async () => {
        const doc = await vscode.workspace.openTextDocument(LogContentProvider.documentUri);
        await vscode.window.showTextDocument(doc, { preview: false });
    });

    context.subscriptions.push(openLogViewerDisposable);

    const getNumberOfActiveFilters = () => {
        return provider.getNumberOfActiveFilters();
    };

    const panelDisposable = vscode.window.registerWebviewViewProvider(
        "t200logs",
        new LogsWebviewViewProvider(context.extensionUri, onFilterChanged, onDisplaySettingsChanged, getNumberOfActiveFilters)
    );
    context.subscriptions.push(panelDisposable);
}

/**
 * Deactivates the extension.
 */
export function deactivate() {}

/**
 * A folding range provider that folds all lines that start with an ISO date.
 */
class LogFoldingRangeProvider implements vscode.FoldingRangeProvider {
    private decorationType: vscode.TextEditorDecorationType;

    /**
     * Creates a new instance of the folding range provider.
     */
    constructor() {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            color: "transparent", // or the background color to 'hide' the text
        });
    }

    /**
     * Provide folding ranges for the given document.
     * @param document The document for which the folding ranges should be computed.
     * @returns An array of folding ranges or `undefined` if the provider does not want to participate or was cancelled.
     */
    provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
        const foldingRanges: vscode.FoldingRange[] = [];
        const isoDateRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g;
        const isDateRegexForHiding = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+\d{2}:\d{2}/;
        const decorations: vscode.DecorationOptions[] = [];

        let currentSecond = null;
        let startLine = null;

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            const match = lineText.match(isoDateRegex);

            if (match) {
                const second = match[0];

                if (currentSecond === second && startLine === null) {
                    startLine = i;
                } else if (currentSecond !== second) {
                    if (startLine !== null) {
                        foldingRanges.push(new vscode.FoldingRange(startLine, i - 1));

                        // Apply decoration to hide dates except the first one in the region
                        for (let line = startLine + 1; line <= i - 1; line++) {
                            // get a new match to get the full date string
                            const dateMatch = document.lineAt(line).text.match(isDateRegexForHiding);
                            if (!dateMatch) {
                                continue;
                            }

                            const startPos = document.lineAt(line).range.start;
                            const endPos = startPos.translate(0, dateMatch[0].length);
                            decorations.push({ range: new vscode.Range(startPos, endPos) });
                        }
                    }
                    currentSecond = second;
                    startLine = null;
                }
            }
        }

        // Set the decorations
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            activeEditor.setDecorations(this.decorationType, decorations);
        }

        return foldingRanges;
    }
}

/**
 * The view provider for the side bar.
 */
class LogsWebviewViewProvider implements vscode.WebviewViewProvider {
    /**
     * Creates a new instance of the view provider.
     * @param extensionUri The path to the extension.
     * @param onFilterChanged The event emitter for when the filter changes.
     * @param onDisplaySettingsChanged The event emitter for when the display settings change.
     * @param getNumberOfActiveFilters A function that returns the number of active filters.
     */
    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly onFilterChanged: vscode.EventEmitter<FilterChangedEvent>,
        private readonly onDisplaySettingsChanged: vscode.EventEmitter<DisplaySettingsChangedEvent>,
        private readonly getNumberOfActiveFilters: () => number
    ) {}

    /**
     * Resolves and defines a webview view.
     * @param webviewView The webview we've been asked to resolve.
     * @param _ The context for the webview.
     * @param __ A cancellation token.
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _: vscode.WebviewViewResolveContext<unknown>,
        __: vscode.CancellationToken
    ): void | Thenable<void> {
        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case "filterCheckboxStateChange":
                    const filterDefinition = message.filterDefinition as FilterKeywordChangedEvent;
                    console.log(message, filterDefinition);

                    if (filterDefinition.isChecked) {
                        this.onFilterChanged.fire({
                            addKeywordFilter: filterDefinition.keyword,
                        });
                    } else {
                        this.onFilterChanged.fire({
                            removeKeywordFilter: filterDefinition.keyword,
                        });
                    }
                    break;

                case "timeFilterInputFromChange":
                    console.log(message);
                    this.onFilterChanged.fire({
                        fromDate: message.timeFilter,
                    });
                    break;

                case "timeFilterInputTillChange":
                    console.log(message);
                    this.onFilterChanged.fire({
                        tillDate: message.timeFilter,
                    });
                    break;
                case "filterNoEventTimeCheckboxStateChange":
                    console.log(message);
                    this.onFilterChanged.fire({
                        removeEntriesWithNoEventTime: message.isChecked,
                    });
                    break;
                case "displayFilenamesCheckboxStateChange":
                    console.log(message);
                    this.onDisplaySettingsChanged.fire({
                        displayFileNames: message.isChecked,
                        displayGuids: null,
                    });
                    break;
                case "displayGuidsCheckboxStateChange":
                    console.log(message);
                    this.onDisplaySettingsChanged.fire({
                        displayFileNames: null,
                        displayGuids: message.isChecked,
                    });
                    break;
            }

            // if command was a filter command - send message back with currently active filters
            if (message.command.startsWith("filter")) {
                const numberOfActiveFilters = this.getNumberOfActiveFilters();
                console.log("numberOfActiveFilters", numberOfActiveFilters);
                void webviewView.webview.postMessage({
                    command: "updateNumberOfActiveFilters",
                    numberOfActiveFilters,
                });
            }
        }, undefined);
    }

    /**
     * Returns the HTML content for the webview.
     * @param webview The webview for which to return the HTML content.
     * @returns The HTML content for the webview.
     */
    private getHtmlForWebview(webview: vscode.Webview): string {
        const htmlPath = path.join(this.extensionUri.path, "src", "sidePanel", "webview.html");
        // Path to the CSS file
        const cssPath = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "src", "sidePanel", "styles.css"));

        const codionCssPath = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "src", "sidePanel", "codion.css"));

        // Path to the JS file
        const jsPath = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "src", "sidePanel", "scripts.js"));

        // path to the toolkit.min.js file
        const toolkitJsPath = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "src", "sidePanel", "toolkit.min.js"));

        // Read HTML content
        let htmlContent = fs.readFileSync(htmlPath, "utf8");

        htmlContent = htmlContent.replace("%%CSS_PATH%%", cssPath.toString());
        htmlContent = htmlContent.replace("%%JS_PATH%%", jsPath.toString());
        htmlContent = htmlContent.replace("%%TOOLKIT_JS_PATH%%", toolkitJsPath.toString());
        htmlContent = htmlContent.replace("%%CODION_CSS_PATH%%", codionCssPath.toString());

        return htmlContent;
    }

}