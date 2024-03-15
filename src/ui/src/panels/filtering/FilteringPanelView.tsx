/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { VSCodeBadge, VSCodeDivider, VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";

import { Flex } from "../../common/Flex";
import { useMessageSubscription } from "../../service/useMessageSubscription";

import { DisplaySettings } from "./DisplaySettings";
import { FileFilter } from "./FileFilter";
import { KeywordFilter } from "./KeywordFilter";
import { LogLevelFilter } from "./LogLevelFilter";
import { OpenLogsViewerButton } from "./OpenLogsViewerButton";
import { TimeFilter } from "./TimeFilter";

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

                    <h3>Filter based on file</h3>
                    <FileFilter />
                    <VSCodeDivider />

                    <h3>Display settings</h3>
                    <p>Please note that some of these settings might affect performance</p>
                    <DisplaySettings />
                </Flex>
            </VSCodePanelView>
        </>
    );
};
