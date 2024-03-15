/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";

import { ExtensionState } from "./ExtensionState";
import { VSCodeApiContext, VSCodeApiContextProps } from "./VSCodeApiProvider";

/**
 * A hook to get the vscode api and message service.
 * @returns The vscode api.
 */
export const useVSCodeApi = (): VSCodeApiContextProps<ExtensionState> => {
    const vscodeApi = React.useContext(VSCodeApiContext);

    if (!vscodeApi) {
        throw new Error("No vscode api provided");
    }

    return vscodeApi;
};
