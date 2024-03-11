/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";

import { PanelRoot } from "./PanelRoot";
import { ExtensionState } from "./vscode/ExtensionState";
import { VSCodeApiProvider } from "./vscode/VSCodeApiProvider";

// eslint-disable-next-line no-undef
const vscodeApi = acquireVsCodeApi<ExtensionState>();

export const App: React.FC = () => {
    return (
        <VSCodeApiProvider api={vscodeApi}>
            <PanelRoot />
        </VSCodeApiProvider>
    );

};