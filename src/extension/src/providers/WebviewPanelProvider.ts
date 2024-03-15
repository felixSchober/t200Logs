/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as fs from "fs";

import { CancellationToken, Uri as VscodeUri, Webview, WebviewView, WebviewViewProvider, WebviewViewResolveContext } from "vscode";

import { ExtensionPostMessageService } from "../service/ExtensionPostMessageService";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { throwIfCancellation } from "../utils/throwIfCancellation";

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
     * Creates a new instance of the view provider.
     * @param extensionUri The path to the extension.
     * @param openLogsDocument A function that opens the logs document.
     * @param postMessageService The post message service.
     * @param logger The logger.
     */
    constructor(
        private readonly extensionUri: VscodeUri,
        openLogsDocument: () => Promise<void>,
        private readonly postMessageService: ExtensionPostMessageService,
        logger: ITelemetryLogger
    ) {
        this.logger = logger.createLoggerScope("WebviewPanelProvider");
        this.logger.info("constructor");

        // try to open the logs document if it hasn't been opened yet
        if (!this.hasLogsViewerBeenOpened) {
            openLogsDocument()
                .then(() => {
                    this.hasLogsViewerBeenOpened = true;
                    this.logger.info("constructor.openLogsDocument");
                })
                .catch(e => {
                    this.logger.logException(
                        "constructor.openLogsDocument",
                        e,
                        "Failed to open logs document",
                        undefined,
                        true,
                        "Side Panel"
                    );
                });
        }
    }

    /**
     * Resolves and defines a webview view.
     * @param webviewView The webview we've been asked to resolve.
     * @param _ The context for the webview.
     * @param token A cancellation token.
     */
    public resolveWebviewView(webviewView: WebviewView, _: WebviewViewResolveContext<unknown>, token: CancellationToken): void {
        throwIfCancellation(token);
        this.logger.info("resolveWebviewView", "Resolving webview view");

        try {
            webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        } catch (e) {
            this.logger.logException("resolveWebviewView", e, "Failed to set HTML content for webview", undefined, true, "Side Panel");
        }

        this.postMessageService.registerWebview(webviewView.webview);
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
                VscodeUri.joinPath(this.extensionUri, "media", "sidePanelReact", "assets"),
                VscodeUri.joinPath(this.extensionUri, "..", "..", "node_modules", "@vscode", "codicons", "dist"),
            ],
        };
        const htmlPath = VscodeUri.joinPath(this.extensionUri, "media", "sidePanelReact", "index.html").with({
            scheme: "vscode-resource",
        }).fsPath;

        // const codiconCssPath = webview.asWebviewUri(
        //     VscodeUri.joinPath(this.extensionUri, "..", "..", "node_modules", "@vscode", "codicons", "dist", "codicon.css")
        // );

        this.logger.info("getHtmlForWebview", "Reading HTML content", { htmlPath });

        // Path to the CSS file
        const codiconCssPath = webview.asWebviewUri(
            VscodeUri.joinPath(this.extensionUri, "media", "sidePanelReact", "assets", "codicon.css")
        );
        const codiconFontPath = webview.asWebviewUri(
            VscodeUri.joinPath(this.extensionUri, "media", "sidePanelReact", "assets", "codicon.ttf")
        );

        // replace the font path in the codiconCssPath CSS file with the webview URI
        let cssContent = fs.readFileSync(codiconCssPath.fsPath, "utf8");
        cssContent = this.replaceCodiconFontPath(cssContent, codiconFontPath.toString());
        fs.writeFileSync(codiconCssPath.fsPath, cssContent);

        // Path to the JS file
        const jsPath = webview.asWebviewUri(VscodeUri.joinPath(this.extensionUri, "media", "sidePanelReact", "main.js"));

        // path to the toolkit.min.js file

        // Read HTML content
        let htmlContent = fs.readFileSync(htmlPath, "utf8");

        htmlContent = htmlContent.replace("/main.js", jsPath.toString());
        htmlContent = htmlContent.replace("%%CODICON_CSS_PATH%%", codiconCssPath.toString());

        this.logger.info("getHtmlForWebview.end", undefined, { htmlContentLength: "" + htmlContent.length });

        return htmlContent;
    }

    /**
     * Replaces the font path in the CSS content with the webview URI.
     * @param cssContent The CSS content of the codicon.css file.
     * @param codiconFontPath The webview URI to the codicon.ttf file.
     * @returns The CSS content with the font path replaced with the webview URI.
     */
    private replaceCodiconFontPath(cssContent: string, codiconFontPath: string): string {
        // The following regex is used to replace the font path in the CSS content with the webview URI.
        // It matches the following pattern:
        // src: url("URL_TO_CODICON/codicon.ttf")
        // There are three capturing groups:
        // 1. src: url("
        // 2. URL_TO_CODICON/codicon.ttf
        // 3. ")
        // These are then used to replace only the middle capturing group ($2) with the webview URI.
        // eslint-disable-next-line no-useless-escape
        const replacementRegex = /(src:\s*url\(\")(.*codicon.ttf)(\"\))/;

        return cssContent.replace(replacementRegex, `$1${codiconFontPath}$3`);
    }
}
