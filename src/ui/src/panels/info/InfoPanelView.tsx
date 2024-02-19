import * as React from "react";
import { VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react";
import { useSendAndReceive } from "../../service/useSendAndReceive";

export const InfoPanelView: React.FC = () => {
    const { send, isPending, response } = useSendAndReceive("getSummary", "getSummaryResponse");

    React.useEffect(() => {
        send({});
    }, [send]);

    return (
        <>
            <VSCodePanelTab id="tab-2">Info</VSCodePanelTab>
            <VSCodePanelView id="view-2">
                {isPending && "Loading..."}
                {JSON.stringify(response, null, 2)}
            </VSCodePanelView>
        </>
    );
};

