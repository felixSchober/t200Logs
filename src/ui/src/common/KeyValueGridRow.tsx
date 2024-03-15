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

    /**
     * Action to be performed when the row is clicked.
     * @returns Void.
     */
    onRowClick?: () => void;

    /**
     * Optional action slots to be rendered at the end of the row.
     * This is useful for adding buttons or other actions to the row.
     * Each action will be rendered as a separate cell in the row.
     */
    actions?: React.ReactNode[];
};

/**
 * A row in a key-value grid.
 * This component is used to display a key-value pair in a grid.
 * @param props The properties for the KeyValueGridRow.
 * @returns The KeyValueGridRow component.
 */
export const KeyValueGridRow: React.FC<KeyValueGridRowProps> = props => {
    const actionCells = props.actions?.map((action, index) => (
        <VSCodeDataGridCell key={`action-${index}`} grid-column={index + 3}>
            {action}
        </VSCodeDataGridCell>
    ));

    return (
        <VSCodeDataGridRow onClick={props.onRowClick}>
            <VSCodeDataGridCell grid-column="1">{props.label}</VSCodeDataGridCell>
            <VSCodeDataGridCell grid-column="2">{props.value ?? "-"}</VSCodeDataGridCell>
            {actionCells}
        </VSCodeDataGridRow>
    );
};

