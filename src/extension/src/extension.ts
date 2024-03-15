/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import type { FilterChangedEvent, TimeFilterChangedEvent } from "@t200logs/common";
import * as vscode from "vscode";

import { ConfigurationManager } from "./configuration";
import { DocumentLocationManager } from "./configuration/DocumentLocationManager";
import { EXTENSION_ID } from "./constants/constants";
import { SummaryInfoProvider } from "./info/SummaryInfoProvider";
import { DateRange, FilterTimeRangeLensProvider } from "./providers/FilterTimeRangeLensProvider";
import { LogFoldingRangeProvider } from "./providers/LogFoldingRangeProvider";
import { WebviewPanelProvider } from "./providers/WebviewPanelProvider";
import { LogContentProvider } from "./providers/content/LogContentProvider";
import { ExtensionPostMessageService } from "./service/ExtensionPostMessageService";
import { WorkspaceFileService } from "./service/WorkspaceFileService";
import { WorkspaceService } from "./service/WorkspaceService";
import { DevLogger } from "./telemetry";
import { ITelemetryLogger } from "./telemetry/ITelemetryLogger";
import { KeywordHighlightDecorator } from "./textDecorations/KeywordHighlightDecorator";
import { TextDecorator } from "./textDecorations/TextDecorator";

let telemetryReporter: Readonly<ITelemetryLogger>;
let logContentProvider: Readonly<LogContentProvider>;
let onCodeLensFilterApplied: vscode.EventEmitter<TimeFilterChangedEvent>;
let postMessageService: ExtensionPostMessageService;
const disposableServices: vscode.Disposable[] = [];
const handlersToUnregister: (() => void)[] = [];

/**
 * Activate the extension.
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log("Extension activated");
    await setupLogging(context);

    const workspaceService = new WorkspaceService(telemetryReporter);
    const documentLocationManager = new DocumentLocationManager(telemetryReporter);
    const configurationManager = new ConfigurationManager(telemetryReporter, workspaceService, documentLocationManager);
    await configurationManager.initialize();
    telemetryReporter.startLogging(configurationManager.shouldShowWelcomeMessage);

    if (!logContentProvider || !postMessageService || !onCodeLensFilterApplied) {
        await telemetryReporter.info("extension.activate().serviceInitialization");
        onCodeLensFilterApplied = new vscode.EventEmitter<TimeFilterChangedEvent>();
        postMessageService = new ExtensionPostMessageService(telemetryReporter);
        const workspaceFileService = new WorkspaceFileService(postMessageService, telemetryReporter);
        logContentProvider = new LogContentProvider(
            onCodeLensFilterApplied.event,
            postMessageService,
            configurationManager,
            documentLocationManager,
            workspaceFileService,
            telemetryReporter
        );

        configurationManager.addPostMessageService(postMessageService);
        workspaceService.addPostMessageService(postMessageService);
        documentLocationManager.addPostMessageService(postMessageService);

        disposableServices.push(onCodeLensFilterApplied);
        disposableServices.push(postMessageService);
        disposableServices.push(logContentProvider);
        disposableServices.push(configurationManager);
        disposableServices.push(workspaceService);
        disposableServices.push(documentLocationManager);
        disposableServices.push(workspaceFileService);
    }

    setupFoldingRangeProvider(context);

    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(LogContentProvider.documentScheme, logContentProvider));

    // Add a command to open the virtual document
    const openLogsDocument = async () => {
        await documentLocationManager.forceLogContentProviderToOpen();
    };
    const openLogViewerDisposable = vscode.commands.registerCommand(`${EXTENSION_ID}.openLogViewer`, async () => {
        await openLogsDocument();
    });
    context.subscriptions.push(openLogViewerDisposable);
    const unregisterOpenLogsDocument = postMessageService.registerMessageHandler("openLogsDocument", (_, respond) => {
        void openLogsDocument().then(() => respond({ command: "messageAck", data: undefined }));
    });
    handlersToUnregister.push(unregisterOpenLogsDocument);

    const resetLogViewerDisposable = vscode.commands.registerCommand(`${EXTENSION_ID}.reset`, () => {
        logContentProvider.reset(true);
    });
    context.subscriptions.push(resetLogViewerDisposable);

    setupCodeLensProvider(context, onCodeLensFilterApplied);
    setupTextDecorator(context, logContentProvider);
    setupKeywordHighlighter(logContentProvider, configurationManager);

    const summaryInfoProvider = new SummaryInfoProvider(postMessageService, telemetryReporter);
    disposableServices.push(summaryInfoProvider);

    const panelDisposable = vscode.window.registerWebviewViewProvider(
        EXTENSION_ID,
        new WebviewPanelProvider(context.extensionUri, openLogsDocument, postMessageService, telemetryReporter),
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        }
    );
    context.subscriptions.push(panelDisposable);

    await telemetryReporter.info("extension.activate().success");
}

/**
 * Set up logging for the extension.
 * @param context The vscode context.
 */
async function setupLogging(context: vscode.ExtensionContext) {
    if (!telemetryReporter) {
        telemetryReporter = createTelemetryReporter(context);
    }

    await telemetryReporter.info("extension.setupLogging", undefined, { logUri: context.logUri.path });

    // setup logging commands
    context.subscriptions.push(
        vscode.commands.registerCommand(EXTENSION_ID + ".openLog", async () => await telemetryReporter.openLogFile())
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(EXTENSION_ID + ".provideFeedback", async () => await telemetryReporter.provideFeedback())
    );
}

/**
 * Set up the code lens provider for the extension.
 * @param context The vscode context.
 * @param onCodeLensFilterApplied The event emitter for filter changes.
 */
function setupCodeLensProvider(context: vscode.ExtensionContext, onCodeLensFilterApplied: vscode.EventEmitter<FilterChangedEvent>) {
    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { scheme: LogContentProvider.documentScheme },
        new FilterTimeRangeLensProvider(telemetryReporter)
    );
    context.subscriptions.push(codeLensDisposable);

    // This is the command that is executed when the user clicks on the code lens.
    const inlineDateFilterDisposable = vscode.commands.registerCommand(FilterTimeRangeLensProvider.commandId, (dateRange: DateRange) => {
        FilterTimeRangeLensProvider.executeCommand(dateRange, onCodeLensFilterApplied);
    });
    context.subscriptions.push(inlineDateFilterDisposable);
}

/**
 * Set up the text decorator for the extension.
 * @param context The vscode context.
 * @param logContentProvider The log content provider for the virtual document.
 */
function setupTextDecorator(context: vscode.ExtensionContext, logContentProvider: Readonly<LogContentProvider>) {
    const textDecorator = new TextDecorator(
        postMessageService,
        logContentProvider.onTextDocumentGenerationFinished.event,
        telemetryReporter
    );
    const disposableDecoration = vscode.commands.registerCommand(`${EXTENSION_ID}.toggleReadableIsoDates`, () => {
        textDecorator.toggleReadableIsoDates();
    });

    const disposableDecorationHints = vscode.commands.registerCommand(`${EXTENSION_ID}.toggleVisualHints`, () => {
        textDecorator.toggleSeverityLevelHighlighting();
    });
    context.subscriptions.push(disposableDecoration);
    context.subscriptions.push(disposableDecorationHints);
    disposableServices.push(textDecorator);
}

/**
 * Set up the keyword highlighter for the extension.
 * @param logContentProvider The log content provider for the virtual document.
 * @param configurationManager The configuration manager for the extension.
 */
function setupKeywordHighlighter(logContentProvider: Readonly<LogContentProvider>, configurationManager: ConfigurationManager) {
    const keywordHighlighter = new KeywordHighlightDecorator(
        postMessageService,
        configurationManager,
        logContentProvider.onTextDocumentGenerationFinished.event,
        telemetryReporter
    );
    disposableServices.push(keywordHighlighter);
}

/**
 * Set up the folding range provider for the extension.
 * @param context The vscode context.
 */
function setupFoldingRangeProvider(context: vscode.ExtensionContext) {
    const foldingProvider = new LogFoldingRangeProvider(telemetryReporter);
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider({ scheme: LogContentProvider.documentScheme, language: "log" }, foldingProvider)
    );
}

/**
 * Deactivates the extension.
 */
export function deactivate() {
    void telemetryReporter.info("extension.deactivate");
    for (const unregister of handlersToUnregister) {
        unregister();
    }
    logContentProvider.dispose();
    if (telemetryReporter) {
        void telemetryReporter.dispose();
    }
    for (const disposable of disposableServices) {
        disposable.dispose();
    }
}

/**
 * Create a telemetry reporter that can be used for this extension.
 * @param context The vscode context.
 * @returns The debug telemetry reporter.
 */
export function createTelemetryReporter(context: vscode.ExtensionContext): Readonly<ITelemetryLogger> {
    return new DevLogger(context.logUri);
}
