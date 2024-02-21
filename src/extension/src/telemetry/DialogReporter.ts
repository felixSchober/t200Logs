/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

/**
 * Class to handle vscode dialogs.
 */
export class DialogReporter {
    /**
     * Displays an error information dialog.
     * @param title Error title.
     * @param message Error message.
     */
    static async showErrorDialog(title?: string, message?: string): Promise<void> {
        if (!title && !message) {
            return;
        }
        // cannot do multiline due to:
        // https://github.com/Microsoft/vscode/issues/48900
        await vscode.window.showErrorMessage(`${title ? title + ": " : "ERROR: "} ${message}`);
    }

    /**
     * Displays an error information dialog.
     * @param title Information title.
     * @param message Information message.
     */
    static async showInformationDialog(title?: string, message?: string): Promise<void> {
        if (!title && !message) {
            return;
        }
        // cannot do multiline due to:
        // https://github.com/Microsoft/vscode/issues/48900
        await vscode.window.showInformationMessage(`${title ? title + ": " : ""} ${message}`);
    }

    /**
     * Displays a message and one button per option string.
     * @param message Message to display.
     * @param options Options to display.
     * @returns The selected option.
     */
    static async showOptionsDialog(message: string, options: string[]): Promise<string | undefined> {
        if (!message) {
            return;
        }
        return await vscode.window.showInformationMessage(message, ...options);
    }
}

