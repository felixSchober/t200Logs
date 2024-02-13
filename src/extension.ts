/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

import { DateRange, FilterTimeRangeLensProvider } from "./codeLensProvider/FilterTimeRangeLensProvider";
import { DisplaySettingsChangedEvent, FilterChangedEvent, LogContentProvider } from "./codeLensProvider/LogContentProvider";
import { LogFoldingRangeProvider } from "./codeLensProvider/LogFoldingRangeProvider";
import { WebviewPanelProvider } from "./codeLensProvider/WebviewPanelProvider";
import { TextDecorator } from "./textDecorations/TextDecorator";

/**
 * Activate the extension.
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    const onWebviewFilterChanged = new vscode.EventEmitter<FilterChangedEvent>();
    const onDisplaySettingsChanged = new vscode.EventEmitter<DisplaySettingsChangedEvent>();
    const logContentProvider = new LogContentProvider(onWebviewFilterChanged.event, onDisplaySettingsChanged.event);
    const textDecorator = new TextDecorator(onDisplaySettingsChanged.event, logContentProvider.onTextDocumentGenerationFinished.event);
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(LogContentProvider.documentScheme, logContentProvider));

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
        vscode.languages.registerFoldingRangeProvider({ scheme: LogContentProvider.documentScheme, language: "log" }, foldingProvider)
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

    let resetLogViewerDisposable = vscode.commands.registerCommand("t200logs.reset", () => {
        logContentProvider.reset();
    });

    const inlineDateFilterDisposable = vscode.commands.registerCommand(FilterTimeRangeLensProvider.commandId, (dateRange: DateRange) => {
        FilterTimeRangeLensProvider.executeCommand(dateRange, onWebviewFilterChanged);
    });

    context.subscriptions.push(openLogViewerDisposable);
    context.subscriptions.push(inlineDateFilterDisposable);
    context.subscriptions.push(resetLogViewerDisposable);

    const getNumberOfActiveFilters = () => {
        return logContentProvider.getNumberOfActiveFilters();
    };
    const panelDisposable = vscode.window.registerWebviewViewProvider(
        "t200logs",
        new WebviewPanelProvider(
            context.extensionUri,
            onWebviewFilterChanged,
            onDisplaySettingsChanged,
            getNumberOfActiveFilters,
            openLogsDocument,
            logContentProvider.onTimeFilterChangeEvent.event
        ),
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        }
    );
    context.subscriptions.push(panelDisposable);

    console.log("T200Logs extension activated");
}

/**
 * Deactivates the extension.
 */
export function deactivate() {}


