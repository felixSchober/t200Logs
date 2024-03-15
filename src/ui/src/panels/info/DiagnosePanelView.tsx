/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";

import { useSendAndReceive } from "../../service/useSendAndReceive";

import { SummaryGrid } from "./SummaryGrid";

export const DiagnosePanelView: React.FC = () => {
    const { send, isPending, response } = useSendAndReceive("getSummary", "getSummaryResponse");

    React.useEffect(() => {
        send({});
    }, [send]);

    return (
        <>
            <VSCodePanelTab id="tab-2">Diagnose</VSCodePanelTab>
            <VSCodePanelView id="view-2">
                <SummaryGrid info={response?.summary} isPending={isPending} />
            </VSCodePanelView>
        </>
    );
};
