/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as fs from "fs";

import {
    CancellationToken,
    EventEmitter,
    commands as VscodeCommands,
    Event as VscodeEvent,
    Uri as VscodeUri,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
} from "vscode";

import { SummaryInfoProvider } from "../info/SummaryInfoProvider";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { KeywordHighlight, KeywordHighlightChangeEvent } from "../textDecorations/KeywordHighlightDecorator";

import { DisplaySettingsChangedEvent, FilterChangedEvent, FilterKeywordChangedEvent, TimeFilterChangedEvent } from "./LogContentProvider";

/**
 * The webview view provider for the logs viewer in the side panel.
 */
export class WebviewPanelProvider implements WebviewViewProvider {
    /**
     * Whether the log viewer has been opened by the webview yet.
     * It is possible that the logs viewer document has been opened by the user before the webview has been opened.
     */
    private hasLogsViewerBeenOpened = false;

    private readonly summaryInfoProvider: SummaryInfoProvider;

    private readonly logger: ScopedILogger;

    /**
     * Creates a new instance of the view provider.
     * @param extensionUri The path to the extension.
     * @param onWebviewFilterChanged The event emitter for when the user changes a filter through the webview.
     * @param onWebviewDisplaySettingsChanged The event emitter for when the user changes display settings change.
     * @param getNumberOfActiveFilters A function that returns the number of active filters.
     * @param openLogsDocument A function that opens the logs document.
     * @param timeChangeEvent The event for when the time filter changes through the LogContentProvider.
     * @param keywordChangeEventEmitter The event emitter for when the user changes a keyword highlight through the webview.
     * @param logger The logger.
     */
    constructor(
        private readonly extensionUri: VscodeUri,
        private readonly onWebviewFilterChanged: EventEmitter<FilterChangedEvent>,
        private readonly onWebviewDisplaySettingsChanged: EventEmitter<DisplaySettingsChangedEvent>,
        private readonly getNumberOfActiveFilters: () => number,
        private readonly openLogsDocument: () => Promise<void>,
        private readonly timeChangeEvent: VscodeEvent<TimeFilterChangedEvent>,
        private readonly keywordChangeEventEmitter: EventEmitter<KeywordHighlightChangeEvent>,
        logger: ITelemetryLogger
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

        this.summaryInfoProvider = new SummaryInfoProvider(logger);
        this.logger = logger.createLoggerScope("WebviewPanelProvider");
    }

    /**
     * Resolves and defines a webview view.
     * @param webviewView The webview we've been asked to resolve.
     * @param _ The context for the webview.
     * @param __ A cancellation token.
     */
    public resolveWebviewView(
        webviewView: WebviewView,
        _: WebviewViewResolveContext<unknown>,
        __: CancellationToken
    ): void | Thenable<void> {
        this.logger.info("resolveWebviewView", "Resolving webview view");

        try {
            webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        } catch (e) {
            this.logger.logException("resolveWebviewView", e, "Failed to set HTML content for webview", undefined, true, "Side Panel");
        }

        webviewView.webview.onDidReceiveMessage(message => {
            this.logger.info("webviewView.onDidReceiveMessage", undefined, message);

            switch (message.command) {
                case "keywordHighlightCheckboxStateChange":
                    let keywordChangeEvent: KeywordHighlightChangeEvent;
                    const highlightDefinition = message.highlightDefinition as KeywordHighlight;

                    if (message.isChecked) {
                        keywordChangeEvent = {
                            addKeyword: highlightDefinition,
                        };
                    } else {
                        keywordChangeEvent = {
                            removeKeyword: highlightDefinition.keyword,
                        };
                    }
                    this.keywordChangeEventEmitter.fire(keywordChangeEvent);
                    break;
                case "filterCheckboxStateChange":
                    const filterDefinition = message.filterDefinition as FilterKeywordChangedEvent;

                    if (filterDefinition.isChecked) {
                        this.onWebviewFilterChanged.fire({
                            addKeywordFilter: filterDefinition.keyword,
                        });
                    } else {
                        this.onWebviewFilterChanged.fire({
                            removeKeywordFilter: filterDefinition.keyword,
                        });
                    }
                    break;

                case "filterLogLevel":
                    let event: FilterChangedEvent;
                    if (message.isChecked) {
                        event = {
                            addLogLevel: message.logLevel,
                        };
                    } else {
                        event = {
                            removeLogLevel: message.logLevel,
                        };
                    }
                    this.onWebviewFilterChanged.fire(event);
                    break;

                case "timeFilterInputFromChange":
                    this.onWebviewFilterChanged.fire({
                        fromDate: message.timeFilter,
                    });
                    break;

                case "timeFilterInputTillChange":
                    this.onWebviewFilterChanged.fire({
                        tillDate: message.timeFilter,
                    });
                    break;
                case "filterNoEventTimeCheckboxStateChange":
                    this.onWebviewFilterChanged.fire({
                        removeEntriesWithNoEventTime: message.isChecked,
                    });
                    break;
                case "filterSessionIdCheckboxStateChange":
                    let changeEvent: FilterChangedEvent;
                    if (message.isChecked) {
                        changeEvent = {
                            setSessionIdFilter: message.sessionId,
                        };
                    } else {
                        changeEvent = {
                            removeSessionIdFilter: message.sessionId,
                        };
                    }
                    this.onWebviewFilterChanged.fire(changeEvent);
                    break;
                case "displayFilenamesCheckboxStateChange":
                    this.onWebviewDisplaySettingsChanged.fire({
                        displayFileNames: message.isChecked,
                        displayGuids: null,
                        displayDatesInLine: null,
                    });
                    break;
                case "displayGuidsCheckboxStateChange":
                    this.onWebviewDisplaySettingsChanged.fire({
                        displayFileNames: null,
                        displayGuids: message.isChecked,
                        displayDatesInLine: null,
                    });
                    break;
                case "displayTimeInlineCheckboxStateChange":
                    this.onWebviewDisplaySettingsChanged.fire({
                        displayFileNames: null,
                        displayGuids: null,
                        displayDatesInLine: message.isChecked,
                    });
                    break;
                case "displayVisualHintsCheckboxStateChange":
                    void VscodeCommands.executeCommand("t200logs.toggleVisualHints");
                    break;
                case "displayReadableIsoDatesCheckboxStateChange":
                    void VscodeCommands.executeCommand("t200logs.toggleReadableIsoDates");
                    break;
                case "openLogsDocument":
                    void this.openLogsDocument();
                    break;
                case "getSummaryInfo":
                    void this.summaryInfoProvider.getSummaryInfo().then(summaryInfo => {
                        void webviewView.webview.postMessage({
                            command: "summaryInfo",
                            summaryInfo,
                        });
                    });
                    break;
                default:
                    this.logger.info("webviewView.onDidReceiveMessage.unknownCommand", "Unknown command", { command: message.command });
                    break;
            }

            // if command was a filter command - send message back with currently active filters
            if (message.command.startsWith("filter")) {
                const numberOfActiveFilters = this.getNumberOfActiveFilters();
                this.logger.info("webviewView.onDidReceiveMessage.filterNumberUpdate", "Sending number of active filters", {
                    numberOfActiveFilters: "" + numberOfActiveFilters,
                });
                void webviewView.webview.postMessage({
                    command: "updateNumberOfActiveFilters",
                    numberOfActiveFilters,
                });
            }
        }, undefined);

        // Subscribe to the time filter change event
        this.timeChangeEvent(timeFilter => {
            void webviewView.webview.postMessage({
                command: "timeFilterChange",
                timeFilter,
            });
        });
    }

    /**
     * Returns the HTML content for the webview.
     * @param webview The webview for which to return the HTML content.
     * @returns The HTML content for the webview.
     */
    private getHtmlForWebview(webview: Webview): string {
        webview.options = {
            enableScripts: true,
            localResourceRoots: [VscodeUri.joinPath(this.extensionUri, "media", "sidePanelReact")],
        };
        const htmlPath = VscodeUri.joinPath(this.extensionUri, "media", "sidePanelReact", "index.html").with({
            scheme: "vscode-resource",
        }).fsPath;

        this.logger.info("getHtmlForWebview", "Reading HTML content", { htmlPath });

        // Path to the CSS file
        // const cssPath = webview.asWebviewUri(VscodeUri.joinPath(this.extensionUri, "media", "sidePanel", "styles.css"));

        // const codiconCssPath = webview.asWebviewUri(VscodeUri.joinPath(this.extensionUri, "media", "sidePanel", "codicon.css"));
        // const codiconFontPath = webview.asWebviewUri(VscodeUri.joinPath(this.extensionUri, "media", "sidePanel", "codicon.ttf"));

        // replace the font path in the codiconCssPath CSS file
        // let cssContent = fs.readFileSync(codiconCssPath.fsPath, "utf8");
        // cssContent = cssContent.replace("%%CODICON_FONT_PATH%%", codiconFontPath.toString());
        // fs.writeFileSync(codiconCssPath.fsPath, cssContent);

        // Path to the JS file
        const jsPath = webview.asWebviewUri(VscodeUri.joinPath(this.extensionUri, "media", "sidePanelReact", "main.js"));

        // path to the toolkit.min.js file
        // const toolkitJsPath = webview.asWebviewUri(VscodeUri.joinPath(this.extensionUri, "media", "sidePanel", "toolkit.min.js"));

        // Read HTML content
        let htmlContent = fs.readFileSync(htmlPath, "utf8");

        // htmlContent = htmlContent.replace("%%CSS_PATH%%", cssPath.toString());
        htmlContent = htmlContent.replace("/main.js", jsPath.toString());
        // htmlContent = htmlContent.replace("%%TOOLKIT_JS_PATH%%", toolkitJsPath.toString());
        // htmlContent = htmlContent.replace("%%CODICON_CSS_PATH%%", codiconCssPath.toString());

        this.logger.info("getHtmlForWebview.end", undefined, { htmlContentLength: "" + htmlContent.length });

        return htmlContent;
    }
}




