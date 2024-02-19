/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";
import { VSCodePanels } from "@vscode/webview-ui-toolkit/react";
import { FilteringPanelView } from "./panels/FilteringPanelView";
import { InfoPanelView } from "./panels/info/InfoPanelView";

export const PanelRoot: React.FC = () => {
    return (
        <VSCodePanels>
            <FilteringPanelView />
            <InfoPanelView />
        </VSCodePanels>
    );
};

