/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { VSCodeButton, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";

import { ColorPicker } from "../../common/ColorPicker";
import { Flex } from "../../common/Flex";
import { createRandomColor } from "../../common/createRandomColor";
import { useLogger } from "../../service/useLogger";

import { useStyles } from "./NewKeywordHighlight.styles";

type NewKeywordHighlightProps = {
    /**
     * Whether the component is in a pending state.
     */
    isPending: boolean;

    /**
     * Callback to be called when a new keyword is added.
     */
    onAddNewKeyword: (keyword: string, color: string) => void;
};

/**
 * A component to add a new keyword to the list of highlighted keywords.
 * @param props The properties for the NewKeywordHighlight component.
 * @returns A NewKeywordHighlight component.
 */
export const NewKeywordHighlight: React.FC<NewKeywordHighlightProps> = props => {
    const { isPending, onAddNewKeyword } = props;

    const classes = useStyles();
    const logger = useLogger("NewKeywordHighlight");
    const [newKeywordField, setNewKeywordField] = React.useState("");
    const [newKeywordColor, setNewKeywordColor] = React.useState<string | null>(null);

    const onTextFieldChange = React.useCallback((event: Event | React.FormEvent<HTMLElement>) => {
        const target = event.target as HTMLInputElement;
        const value = target.value;
        setNewKeywordField(value);
    }, []);

    const onAddCurrentKeyword = React.useCallback(() => {
        let color = newKeywordColor ?? createRandomColor(true);

        logger.log("onAddCurrentKeyword", `Added new keyword ${newKeywordField} with color ${color}`);
        onAddNewKeyword(newKeywordField, color);
        setNewKeywordField("");
        setNewKeywordColor(null);
    }, [newKeywordField, onAddNewKeyword, newKeywordColor, logger]);

    /**
     * Keyboard event handler on the text field to add a new keyword on Enter.
     */
    const onTextFieldKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
            if (event.key === "Enter") {
                onAddCurrentKeyword();
            }
        },
        [onAddCurrentKeyword]
    );

    const onColorChange = React.useCallback((color: string) => {
        setNewKeywordColor(color);
    }, []);

    return (
        <Flex direction="row" wrap="wrap" justifyContent="flex-start" className={classes.container}>
            <VSCodeTextField
                value={newKeywordField}
                onInput={onTextFieldChange}
                placeholder="\.*REGEX.*/"
                disabled={isPending}
                onKeyDown={onTextFieldKeyDown}>
                Add a new keyword
            </VSCodeTextField>
            <ColorPicker initialColor={newKeywordColor} onColorChange={onColorChange} className={classes.colorPicker} />
            <VSCodeButton onClick={onAddCurrentKeyword} disabled={isPending} className={classes.removeButton}>
                Add
                <span slot="start" className="codicon codicon-add"></span>
            </VSCodeButton>
        </Flex>
    );

};