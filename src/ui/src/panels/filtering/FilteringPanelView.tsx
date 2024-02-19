import * as React from "react";
import { VSCodeDivider, VSCodePanelTab, VSCodePanelView, VSCodeBadge } from "@vscode/webview-ui-toolkit/react";
import { OpenLogsViewerButton } from "./OpenLogsViewerButton";
import { Flex } from "../../common/Flex";
import { LogLevelFilter } from "./LogLevelFilter";
import { TimeFilter } from "./TimeFilter";
import { useMessageSubscription } from "../../service/useMessageSubscription";
import { KeywordFilter } from "./KeywordFilter";
import { DisplaySettings } from "./DisplaySettings";

export const FilteringPanelView: React.FC = () => {
    const activeFilters = useMessageSubscription("updateNumberOfActiveFilters");
    return (
        <>
            <VSCodePanelTab id="tab-1">
                Filtering {activeFilters && activeFilters > 0 ? <VSCodeBadge>{activeFilters}</VSCodeBadge> : null}
            </VSCodePanelTab>
            <VSCodePanelView id="view-1">
                <Flex direction="column" hFill>
                    <OpenLogsViewerButton />
                    <VSCodeDivider />

                    <h3>Filter based on log level</h3>
                    <LogLevelFilter />
                    <VSCodeDivider />

                    <h3>Filter based on time</h3>
                    <TimeFilter />
                    <VSCodeDivider />

                    <h3>Filter based on keyword</h3>
                    <KeywordFilter />
                    <VSCodeDivider />

                    <h3>Display settings</h3>
                    <p>Please note that some of these settings might affect performance</p>
                    <DisplaySettings />
                </Flex>
            </VSCodePanelView>
        </>
    );
};





