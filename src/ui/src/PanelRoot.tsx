/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";
import { VSCodePanels } from "@vscode/webview-ui-toolkit/react";
import { FilteringPanelView } from "./panels/filtering/FilteringPanelView";
import { InfoPanelView } from "./panels/info/InfoPanelView";
import { KeywordHighlightView } from "./panels/highlighting/KeywordHighlightView";

export const PanelRoot: React.FC = () => {
    return (
        <VSCodePanels>
            <FilteringPanelView />
            <InfoPanelView />
            <KeywordHighlightView />
        </VSCodePanels>
    );
};



