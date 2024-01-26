/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/* eslint-disable max-classes-per-file */
import * as fs from "fs";
import * as path from "path";

import * as vscode from "vscode";

import { DateRange, FilterTimeRangeLensProvider } from "./codeLensProvider/FilterTimeRangeLensProvider";
import {
    DisplaySettingsChangedEvent,
    FilterChangedEvent,
    FilterKeywordChangedEvent,
    LogContentProvider,
} from "./codeLensProvider/LogContentProvider";
import { TextDecorator } from "./textDecorations/TextDecorator";

/**
 * Activate the extension.
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    const onFilterChanged = new vscode.EventEmitter<FilterChangedEvent>();
    const onDisplaySettingsChanged = new vscode.EventEmitter<DisplaySettingsChangedEvent>();
    const provider = new LogContentProvider(onFilterChanged.event, onDisplaySettingsChanged.event);
    const textDecorator = new TextDecorator();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(LogContentProvider.documentScheme, provider));

    let codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { scheme: LogContentProvider.documentScheme },
        new FilterTimeRangeLensProvider()
    );

    let disposableDecoration = vscode.commands.registerCommand("t200logs.toggleReadableIsoDates", () => {
        textDecorator.toggleReadableIsoDates();
    });

    let disposableDecorationHints = vscode.commands.registerCommand("t200logs.toggleVisualHints", () => {
        textDecorator.toggleSeverityLevelHighlighting();
    });

    const foldingProvider = new LogFoldingRangeProvider();
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            { scheme: LogContentProvider.documentScheme, language: "log" }, // Adjust the language if necessary
            foldingProvider
        )
    );

    context.subscriptions.push(codeLensDisposable);
    context.subscriptions.push(disposableDecoration);
    context.subscriptions.push(disposableDecorationHints);

    // Add a command to open the virtual document
    const openLogsDocument = async () => {
        const doc = await vscode.workspace.openTextDocument(LogContentProvider.documentUri);
        await vscode.window.showTextDocument(doc, { preview: false });
    };
    let openLogViewerDisposable = vscode.commands.registerCommand("t200logs.openLogViewer", async () => {
        await openLogsDocument();
    });

    const inlineDateFilterDisposable = vscode.commands.registerCommand(FilterTimeRangeLensProvider.commandId, (dateRange: DateRange) => {
        FilterTimeRangeLensProvider.executeCommand(dateRange, onFilterChanged);
    });

    context.subscriptions.push(openLogViewerDisposable);
    context.subscriptions.push(inlineDateFilterDisposable);

    const getNumberOfActiveFilters = () => {
        return provider.getNumberOfActiveFilters();
    };
    const panelDisposable = vscode.window.registerWebviewViewProvider(
        "t200logs",
        new LogsWebviewViewProvider(
            context.extensionUri,
            onFilterChanged,
            onDisplaySettingsChanged,
            getNumberOfActiveFilters,
            openLogsDocument
        )
    );
    context.subscriptions.push(panelDisposable);

    console.log("T200Logs extension activated");
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
        // const isDateRegexForHiding = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+\d{2}:\d{2}/;
        const endMarkerRegex = new RegExp(`.*${LogContentProvider.foldingRegionEndMarker}.*`, "g");
        const decorations: vscode.DecorationOptions[] = [];
        let startLine = null;

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            const startRegionMatch = lineText.match(isoDateRegex);
            const endRegionMatch = lineText.match(endMarkerRegex);

            if (startRegionMatch) {
                startLine = i;
            }

            if (endRegionMatch) {
                if (startLine !== null) {
                    foldingRanges.push(new vscode.FoldingRange(startLine, i));
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
     * Whether the log viewer has been opened by the webview yet.
     * It is possible that the logs viewer document has been opened by the user before the webview has been opened.
     */
    private hasLogsViewerBeenOpened = false;

    /**
     * Creates a new instance of the view provider.
     * @param extensionUri The path to the extension.
     * @param onFilterChanged The event emitter for when the filter changes.
     * @param onDisplaySettingsChanged The event emitter for when the display settings change.
     * @param getNumberOfActiveFilters A function that returns the number of active filters.
     * @param openLogsDocument A function that opens the logs document.
     */
    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly onFilterChanged: vscode.EventEmitter<FilterChangedEvent>,
        private readonly onDisplaySettingsChanged: vscode.EventEmitter<DisplaySettingsChangedEvent>,
        private readonly getNumberOfActiveFilters: () => number,
        private readonly openLogsDocument: () => Promise<void>
    ) {
        console.log("LogsWebviewViewProvider constructor");

        // try to open the logs document if it hasn't been opened yet
        if (!this.hasLogsViewerBeenOpened) {
            this.openLogsDocument()
                .then(() => {
                    this.hasLogsViewerBeenOpened = true;
                    console.log("LogsWebviewViewProvider: opened logs document");
                })
                .catch(e => {
                    console.error("Failed to open logs document", e);
                });
        }
    }

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
                case "displayVisualHintsCheckboxStateChange":
                    console.log(message);
                    void vscode.commands.executeCommand("t200logs.toggleVisualHints");
                    break;
                case "displayReadableIsoDatesCheckboxStateChange":
                    console.log(message);
                    void vscode.commands.executeCommand("t200logs.toggleReadableIsoDates");
                    break;
                case "openLogsDocument":
                    void this.openLogsDocument();
                    break;
                default:
                    console.warn("unknown command", message);
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