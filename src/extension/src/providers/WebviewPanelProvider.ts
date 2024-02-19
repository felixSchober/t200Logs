/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as fs from "fs";

import {
    CancellationToken,
    EventEmitter,
    Event as VscodeEvent,
    Uri as VscodeUri,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
} from "vscode";

import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import {
    type DisplaySettingsChangedEvent,
    type FilterChangedEvent,
    type KeywordHighlightChangeEvent,
    type TimeFilterChangedEvent,
} from "@t200logs/common";
import { ExtensionPostMessageService } from "../ExtensionPostMessageService";

/**
 * The webview view provider for the logs viewer in the side panel.
 */
export class WebviewPanelProvider implements WebviewViewProvider {
    /**
     * Whether the log viewer has been opened by the webview yet.
     * It is possible that the logs viewer document has been opened by the user before the webview has been opened.
     */
    private hasLogsViewerBeenOpened = false;

    private readonly logger: ScopedILogger;

    /**
     * The post message service for the webview.
     */
    private readonly postMessageService: ExtensionPostMessageService;

    /**
     * Unscoped version of the logger.
     * For usage within this class, use {@link logger}.
     */
    private readonly _telemetryLogger: ITelemetryLogger;

    /**
     * Creates a new instance of the view provider.
     * @param extensionUri The path to the extension.
     * @param onWebviewFilterChanged The event emitter for when the user changes a filter through the webview.
     * @param onWebviewDisplaySettingsChanged The event emitter for when the user changes display settings change.
     * @param getNumberOfActiveFilters A function that returns the number of active filters.
     * @param openLogsDocument A function that opens the logs document.
     * @param timeChangeEvent The event for when the time filter changes through the LogContentProvider.
     * @param keywordChangeEventEmitter The event emitter for when the user changes a keyword highlight through the webview.
     * @param _telemetryLogger The logger
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

        this.postMessageService = new ExtensionPostMessageService(
            onWebviewFilterChanged,
            onWebviewDisplaySettingsChanged,
            getNumberOfActiveFilters,
            timeChangeEvent,
            keywordChangeEventEmitter,
            logger
        );
        this.logger = logger.createLoggerScope("WebviewPanelProvider");
        this._telemetryLogger = logger;
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

        this.postMessageService.registerWebview(webviewView.webview);

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
            localResourceRoots: [
                VscodeUri.joinPath(this.extensionUri, "media", "sidePanelReact"),
                VscodeUri.joinPath(this.extensionUri, "..", "..", "node_modules", "@vscode", "codicons", "dist"),
            ],
        };
        const htmlPath = VscodeUri.joinPath(this.extensionUri, "media", "sidePanelReact", "index.html").with({
            scheme: "vscode-resource",
        }).fsPath;

        const codiconCssPath = webview.asWebviewUri(
            VscodeUri.joinPath(this.extensionUri, "..", "..", "node_modules", "@vscode", "codicons", "dist", "codicon.css")
        );

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
        htmlContent = htmlContent.replace("%%CODICON_CSS_PATH%%", codiconCssPath.toString());

        this.logger.info("getHtmlForWebview.end", undefined, { htmlContentLength: "" + htmlContent.length });

        return htmlContent;
    }
}











