import * as React from "react";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { useSendAndReceive } from "../../service/useSendAndReceive";

/**
 * A button that opens the logs viewer
 * @returns A button that opens the logs viewer
 */
export const OpenLogsViewerButton: React.FC = () => {
    const { isPending, send } = useSendAndReceive("openLogsDocument", "messageAck");

    return (
        <VSCodeButton onClick={() => send(undefined)} disabled={isPending}>
            Open Logs Viewer
        </VSCodeButton>
    );
};


