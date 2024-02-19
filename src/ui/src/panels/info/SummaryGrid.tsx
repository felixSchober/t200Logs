import * as React from "react";
import { VSCodeDataGrid, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { SummaryInfo } from "@t200logs/common";
import { KeyValueGridRow } from "../../common/KeyValueGridRow";
import { Flex } from "../../common/Flex";

type SummaryGridProps = {
    /**
     * The summary info
     */
    info: SummaryInfo | undefined;

    /**
     * When true, the summary is loading
     */
    isPending: boolean;
};

export const SummaryGrid: React.FC<SummaryGridProps> = props => {
    let summaryGridContent = null;
    if (props.isPending) {
        summaryGridContent = <VSCodeProgressRing>Loading</VSCodeProgressRing>;
    } else if (!props.info) {
        summaryGridContent = <p>No data. Please make sure a summary.txt file is present</p>;
    } else {
        summaryGridContent = (
            <VSCodeDataGrid generate-header="none" grid-template-columns="1fr 1fr" aria-label="Summary txt values">
                <KeyValueGridRow label="Session Id" value={props.info.sessionId} />
                <KeyValueGridRow label="Device Id" value={props.info.deviceId} />
                <KeyValueGridRow label="Host Version" value={props.info.hostVersion} />
                <KeyValueGridRow label="Web Version" value={props.info.webVersion} />
                <KeyValueGridRow label="Language" value={props.info.language} />
                <KeyValueGridRow label="Ring" value={props.info.ring} />
                {props.info.users.map((user, index) => (
                    <KeyValueGridRow
                        key={user.oid || index}
                        label={user.upn || user.oid || user.userId || `User ${index}`}
                        value={user.tenantId}
                    />
                ))}
            </VSCodeDataGrid>
        );
    }

    return (
        <Flex direction="column">
            <h2>Summary</h2>
            <p>Data found in summary.txt:</p>
            {summaryGridContent}
        </Flex>
    );
};

