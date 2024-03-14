/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

import { LogContentProvider } from "../providers/content/LogContentProvider";

/**
 * Gets the log content provider's visible text editor.
 * @returns The log content provider's visible text editor.
 */
export const getEditor = () => {
    return vscode.window.visibleTextEditors.find(e => e.document.uri.path === LogContentProvider.documentUri.path);
};
