/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

import { EXTENSION_ID } from "./constants/constants";
import { DateRange, FilterTimeRangeLensProvider } from "./providers/FilterTimeRangeLensProvider";
import { DisplaySettingsChangedEvent, FilterChangedEvent, LogContentProvider } from "./providers/LogContentProvider";
import { LogFoldingRangeProvider } from "./providers/LogFoldingRangeProvider";
import { WebviewPanelProvider } from "./providers/WebviewPanelProvider";
import { DevLogger } from "./telemetry";
import { ITelemetryLogger } from "./telemetry/ITelemetryLogger";
import { TextDecorator } from "./textDecorations/TextDecorator";

let telemetryReporter: Readonly<ITelemetryLogger>;
let logContentProvider: Readonly<LogContentProvider>;
let onWebviewFilterChanged: vscode.EventEmitter<FilterChangedEvent>;
let onDisplaySettingsChanged: vscode.EventEmitter<DisplaySettingsChangedEvent>;

/**
 * Activate the extension.
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log("Extension activated");
    await setupLogging(context);
    setupFoldingRangeProvider(context);

    if (!logContentProvider || !onWebviewFilterChanged || !onDisplaySettingsChanged) {
        onWebviewFilterChanged = new vscode.EventEmitter<FilterChangedEvent>();
        onDisplaySettingsChanged = new vscode.EventEmitter<DisplaySettingsChangedEvent>();

        logContentProvider = new LogContentProvider(onWebviewFilterChanged.event, onDisplaySettingsChanged.event, telemetryReporter);
    }

    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(LogContentProvider.documentScheme, logContentProvider));

    // Add a command to open the virtual document
    const openLogsDocument = async () => {
        const doc = await vscode.workspace.openTextDocument(LogContentProvider.documentUri);
        await vscode.window.showTextDocument(doc, { preview: false });
    };
    let openLogViewerDisposable = vscode.commands.registerCommand(`${EXTENSION_ID}.openLogViewer`, async () => {
        await openLogsDocument();
    });
    context.subscriptions.push(openLogViewerDisposable);

    let resetLogViewerDisposable = vscode.commands.registerCommand(`${EXTENSION_ID}.reset`, () => {
        logContentProvider.reset();
    });
    context.subscriptions.push(resetLogViewerDisposable);

    setupCodeLensProvider(context, onWebviewFilterChanged);
    setupTextDecorator(context, logContentProvider, onDisplaySettingsChanged);

    const getNumberOfActiveFilters = () => {
        return logContentProvider.getNumberOfActiveFilters();
    };
    const panelDisposable = vscode.window.registerWebviewViewProvider(
        EXTENSION_ID,
        new WebviewPanelProvider(
            context.extensionUri,
            onWebviewFilterChanged,
            onDisplaySettingsChanged,
            getNumberOfActiveFilters,
            openLogsDocument,
            logContentProvider.onTimeFilterChangeEvent.event,
            telemetryReporter
        ),
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

    telemetryReporter.startLogging();
}

/**
 * Set up the code lens provider for the extension.
 * @param context The vscode context.
 * @param onWebviewFilterChanged The event emitter for filter changes.
 */
function setupCodeLensProvider(context: vscode.ExtensionContext, onWebviewFilterChanged: vscode.EventEmitter<FilterChangedEvent>) {
    let codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { scheme: LogContentProvider.documentScheme },
        new FilterTimeRangeLensProvider(telemetryReporter)
    );
    context.subscriptions.push(codeLensDisposable);

    // This is the command that is executed when the user clicks on the code lens.
    const inlineDateFilterDisposable = vscode.commands.registerCommand(FilterTimeRangeLensProvider.commandId, (dateRange: DateRange) => {
        FilterTimeRangeLensProvider.executeCommand(dateRange, onWebviewFilterChanged);
    });
    context.subscriptions.push(inlineDateFilterDisposable);
}

/**
 * Set up the text decorator for the extension.
 * @param context The vscode context.
 * @param logContentProvider The log content provider for the virtual document.
 * @param onDisplaySettingsChanged The event emitter for display settings changes.
 */
function setupTextDecorator(
    context: vscode.ExtensionContext,
    logContentProvider: Readonly<LogContentProvider>,
    onDisplaySettingsChanged: vscode.EventEmitter<DisplaySettingsChangedEvent>
) {
    const textDecorator = new TextDecorator(
        onDisplaySettingsChanged.event,
        logContentProvider.onTextDocumentGenerationFinished.event,
        telemetryReporter
    );
    let disposableDecoration = vscode.commands.registerCommand(`${EXTENSION_ID}.toggleReadableIsoDates`, () => {
        textDecorator.toggleReadableIsoDates();
    });

    let disposableDecorationHints = vscode.commands.registerCommand(`${EXTENSION_ID}.toggleVisualHints`, () => {
        textDecorator.toggleSeverityLevelHighlighting();
    });
    context.subscriptions.push(disposableDecoration);
    context.subscriptions.push(disposableDecorationHints);
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
    logContentProvider.dispose();
    if (telemetryReporter) {
        void telemetryReporter.dispose();
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













