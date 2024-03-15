/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { VSCodeButton, VSCodeDataGrid, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";

import { Flex } from "../../common/Flex";
import { KeyValueGridRow } from "../../common/KeyValueGridRow";
import { useLogger } from "../../service/useLogger";
import { useMessageSubscription } from "../../service/useMessageSubscription";
import { useSendAndReceive } from "../../service/useSendAndReceive";

export const ErrorList: React.FC = () => {
    const errorList = useMessageSubscription("setErrorList");
    const { send: jumpToRow } = useSendAndReceive("jumpToRow", "messageAck");
    const logger = useLogger("ErrorList");
    const isPending = errorList === null;
    const isEmpty = errorList?.length === 0;

    let gridContent = null;
    if (isPending) {
        gridContent = <VSCodeProgressRing>Loading</VSCodeProgressRing>;
    } else if (isEmpty) {
        gridContent = <p>No errors found.</p>;
    } else {
        gridContent = (
            <VSCodeDataGrid generate-header="none" grid-template-columns="100px 1fr 30px" aria-label="List of errors">
                {errorList.map((errorLogEntry, index) => {
                    const onRowClick = () => {
                        const rowNumber = errorLogEntry.rowNumber;
                        if (!rowNumber) {
                            logger.logError(
                                "onRowClick",
                                `Error log entry does not have a row. ${errorLogEntry.date} - ${errorLogEntry.text}`
                            );
                            return;
                        }
                        jumpToRow(rowNumber);
                    };

                    return (
                        <KeyValueGridRow
                            key={`error_${errorLogEntry.text.substring(0, 10)}`}
                            label={errorLogEntry.date.toLocaleTimeString()}
                            value={errorLogEntry.text}
                            onRowClick={onRowClick}
                            actions={[
                                <VSCodeButton key={`remove${index}`} appearance="icon" aria-label="Open file" title="Open file">
                                    <span className="codicon codicon-go-to-file"></span>
                                </VSCodeButton>,
                            ]}
                        />
                    );
                })}
            </VSCodeDataGrid>
        );
    }

    return (
        <Flex direction="column">
            <h2>Errors</h2>
            {gridContent}
        </Flex>
    );
};

