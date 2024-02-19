import * as React from "react";
import { VSCodeDataGridRow, VSCodeDataGridCell } from "@vscode/webview-ui-toolkit/react";

type KeyValueGridRowProps = {
    /**
     * The label
     */
    label: string;

    /**
     * The value
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

