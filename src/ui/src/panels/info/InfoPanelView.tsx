import * as React from "react";
import { VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react";
import { useSendAndReceive } from "../../service/useSendAndReceive";
import { SummaryGrid } from "./SummaryGrid";

export const InfoPanelView: React.FC = () => {
    const { send, isPending, response } = useSendAndReceive("getSummary", "getSummaryResponse");

    React.useEffect(() => {
        send({});
    }, [send]);

    return (
        <>
            <VSCodePanelTab id="tab-2">Info</VSCodePanelTab>
            <VSCodePanelView id="view-2">
                <SummaryGrid info={response?.summary} isPending={isPending} />
            </VSCodePanelView>
        </>
    );
};


