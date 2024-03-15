/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { VSCodeDataGrid, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";

import { Flex } from "../../common/Flex";
import { KeyValueGridRow } from "../../common/KeyValueGridRow";
import { useMessageSubscription } from "../../service/useMessageSubscription";

export const ErrorList: React.FC = () => {
    const errorList = useMessageSubscription("setErrorList");
    const isPending = errorList === null;
    const isEmpty = errorList?.length === 0;

    let gridContent = null;
    if (isPending) {
        gridContent = <VSCodeProgressRing>Loading</VSCodeProgressRing>;
    } else if (isEmpty) {
        gridContent = <p>No errors found.</p>;
    } else {
        gridContent = (
            <VSCodeDataGrid generate-header="none" grid-template-columns="100px 1fr" aria-label="List of errors">
                {errorList.map((errorLogEntry, index) => (
                    <KeyValueGridRow
                        key={errorLogEntry.date.getTime() || index}
                        label={errorLogEntry.date.toLocaleTimeString()}
                        value={errorLogEntry.text}
                    />
                ))}
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
