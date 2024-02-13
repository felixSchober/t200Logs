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

    /**
     * Creates a new instance of the view provider.
     * @param extensionUri The path to the extension.
     * @param onWebviewFilterChanged The event emitter for when the user changes a filter through the webview.
     * @param onWebviewDisplaySettingsChanged The event emitter for when the user changes display settings change.
     * @param getNumberOfActiveFilters A function that returns the number of active filters.
     * @param openLogsDocument A function that opens the logs document.
     * @param timeChangeEvent The event for when the time filter changes through the LogContentProvider.
     */
    constructor(
        private readonly extensionUri: VscodeUri,
        private readonly onWebviewFilterChanged: EventEmitter<FilterChangedEvent>,
        private readonly onWebviewDisplaySettingsChanged: EventEmitter<DisplaySettingsChangedEvent>,
        private readonly getNumberOfActiveFilters: () => number,
        private readonly openLogsDocument: () => Promise<void>,
        private readonly timeChangeEvent: VscodeEvent<TimeFilterChangedEvent>
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

        this.summaryInfoProvider = new SummaryInfoProvider();
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
        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(message => {
            console.log("webviewView.onDidReceiveMessage", message);
            switch (message.command) {
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
            localResourceRoots: [VscodeUri.joinPath(this.extensionUri, "media", "sidePanel")],
        };
        const htmlPath = VscodeUri.joinPath(this.extensionUri, "media", "sidePanel", "webview.html").with({
            scheme: "vscode-resource",
        }).fsPath;
        // Path to the CSS file
        const cssPath = webview.asWebviewUri(VscodeUri.joinPath(this.extensionUri, "media", "sidePanel", "styles.css"));

        const codionCssPath = webview.asWebviewUri(VscodeUri.joinPath(this.extensionUri, "media", "sidePanel", "codion.css"));

        // Path to the JS file
        const jsPath = webview.asWebviewUri(VscodeUri.joinPath(this.extensionUri, "media", "sidePanel", "scripts.js"));

        // path to the toolkit.min.js file
        const toolkitJsPath = webview.asWebviewUri(VscodeUri.joinPath(this.extensionUri, "media", "sidePanel", "toolkit.min.js"));

        // Read HTML content
        let htmlContent = fs.readFileSync(htmlPath, "utf8");

        htmlContent = htmlContent.replace("%%CSS_PATH%%", cssPath.toString());
        htmlContent = htmlContent.replace("%%JS_PATH%%", jsPath.toString());
        htmlContent = htmlContent.replace("%%TOOLKIT_JS_PATH%%", toolkitJsPath.toString());
        htmlContent = htmlContent.replace("%%CODION_CSS_PATH%%", codionCssPath.toString());

        return htmlContent;
    }
}


