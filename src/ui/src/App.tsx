/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";
import { VSCodeApiProvider } from "./vscode/VSCodeApiProvider";
import { PanelRoot } from "./PanelRoot";

const vscodeApi = acquireVsCodeApi();

export const App: React.FC = () => {
    return (
        <VSCodeApiProvider api={vscodeApi}>
          <PanelRoot />
        </VSCodeApiProvider>
      )
};