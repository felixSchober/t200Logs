import * as React from "react";
import { VSCodeDivider, VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react";
import { OpenLogsViewerButton } from "./OpenLogsViewerButton";
import { Flex } from "../../common/Flex";
import { LogLevelFilter } from "./LogLevelFilter";

export const FilteringPanelView: React.FC = () => {
    return (
        <>
            <VSCodePanelTab id="tab-1">Filtering</VSCodePanelTab>
            <VSCodePanelView id="view-1">
                <Flex direction="column" hFill>
                    <OpenLogsViewerButton />
                    <VSCodeDivider />

                    <h3>Filter based on log level</h3>
                    <LogLevelFilter />
                </Flex>
            </VSCodePanelView>
        </>
    );
};

