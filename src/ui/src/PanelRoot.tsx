/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { VSCodePanels } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";

import { DiagnosePanelView } from "./panels/diagnose/DiagnosePanelView";
import { FilteringPanelView } from "./panels/filtering/FilteringPanelView";
import { KeywordHighlightView } from "./panels/highlighting/KeywordHighlightView";
import { useSendAndReceive } from "./service/useSendAndReceive";

export const PanelRoot: React.FC = () => {
    const { send } = useSendAndReceive("webviewReady", "messageAck", 4000);

    React.useEffect(() => {
        // notify the extension that the webview is ready
        send(undefined);
    }, [send]);

    return (
        <VSCodePanels>
            <FilteringPanelView />
            <DiagnosePanelView />
            <KeywordHighlightView />
        </VSCodePanels>
    );
};
