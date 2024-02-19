import * as React from "react";
import { VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react";

export const FilteringPanelView: React.FC = () => {
    return (
        <>
            <VSCodePanelTab id="tab-1">Filtering</VSCodePanelTab>
            <VSCodePanelView id="view-1">CONTENT2</VSCodePanelView>
        </>
    );
};
