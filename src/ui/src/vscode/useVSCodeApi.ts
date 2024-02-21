import { ExtensionWebviewState, VSCodeApiContext, VSCodeApiContextProps } from "./VSCodeApiProvider";
import * as React from "react";

/**
 * A hook to get the vscode api and message service
 * @returns The vscode api
 */
export const useVSCodeApi = (): VSCodeApiContextProps<ExtensionWebviewState> => {
    const vscodeApi = React.useContext(VSCodeApiContext);

    if (!vscodeApi) {
        throw new Error("No vscode api provided");
    }

    return vscodeApi;
};

