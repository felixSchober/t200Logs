/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { makeStyles, shorthands } from "@griffel/react";

export const useStyles = makeStyles({
    swatch: {
        width: "1rem",
        height: "1rem",
        ...shorthands.borderRadius("50%"),
        marginLeft: "auto",
        alignSelf: "center",
        cursor: "pointer",

        "&:hover": {
            ...shorthands.border("1px", "solid", "--vscode-focusBorder")
        },
    },
    popover: {
        position: "absolute",
        zIndex: "2",
    },
    cover: {
        position: "fixed",
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px",
    }
});