/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { VSCodeDataGridCell, VSCodeDataGridRow } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";

type KeyValueGridRowProps = {
    /**
     * The label.
     */
    label: string;

    /**
     * The value.
     */
    value: string | null;
};

export const KeyValueGridRow: React.FC<KeyValueGridRowProps> = props => {
    return (
        <VSCodeDataGridRow>
            <VSCodeDataGridCell grid-column="1">{props.label}</VSCodeDataGridCell>
            <VSCodeDataGridCell grid-column="2">{props.value ?? "-"}</VSCodeDataGridCell>
        </VSCodeDataGridRow>
    );
};
