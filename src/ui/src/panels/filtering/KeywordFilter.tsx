/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { VSCodeButton, VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import { v4 as uuid } from "uuid";

import { Flex } from "../../common/Flex";
import { useLogger } from "../../service/useLogger";
import { useMessageSubscription } from "../../service/useMessageSubscription";
import { useSendAndReceive } from "../../service/useSendAndReceive";

type KeywordDefinition = {
    /**
     * The unique identifier for the keyword.
     */
    id: string;

    /**
     * The keyword to filter on.
     */
    keyword: string;

    /**
     * Whether the keyword is enabled.
     */
    isChecked: boolean;

    /**
     * Whether the keyword is a custom keyword that was added by the user through the UI.
     */
    isCustom: boolean;
};

const predefinedKeywords: KeywordDefinition[] = [];

export const KeywordFilter: React.FC = () => {
    const { log, logError } = useLogger("KeywordFilter");
    const [keywords, setKeywords] = React.useState<KeywordDefinition[]>(predefinedKeywords);
    const [newKeywordField, setNewKeywordField] = React.useState("");
    const { send, isPending } = useSendAndReceive("filterCheckboxStateChange", "updateNumberOfActiveFilters");
    const { send: sendConfigUpdate } = useSendAndReceive("updateFilterCheckboxState", "messageAck");
    const keywordsFromConfiguration = useMessageSubscription("setKeywordFiltersFromConfiguration");

    React.useEffect(() => {
        if (keywordsFromConfiguration && keywordsFromConfiguration.length > 0) {
            setKeywords(prev => {
                const newKeywords: KeywordDefinition[] = keywordsFromConfiguration.map(kw => {
                    return {
                        keyword: kw.value,
                        isCustom: false,
                        id: uuid(),
                        isChecked: kw.isChecked,
                    };
                });
                return [...prev, ...newKeywords];
            });
        }
    }, [keywordsFromConfiguration]);

    const onCheckboxChange = React.useCallback(
        (event: Event | React.FormEvent<HTMLElement>) => {
            const target = event.target as HTMLInputElement;
            const value = target.checked;
            const name = target.name;

            const keywordId = name.split("_")[1];

            setKeywords(prev => {
                const keyword = prev.find(kw => kw.id === keywordId);
                if (keyword) {
                    keyword.isChecked = value;
                    log(
                        "onCheckboxChange",
                        `Sending keyword '${keyword.keyword}' with id: ${keywordId} and value: ${value} to the extension backend`
                    );
                    send({ id: keywordId, isChecked: value, value: keyword.keyword });
                    sendConfigUpdate({ id: keywordId, isChecked: value, value: keyword.keyword, updateType: "update" });
                } else {
                    logError("onCheckboxChange", `Could not find keyword with id '${keywordId}' and name '${name}'`);
                }
                return [...prev];
            });
        },
        [log, logError, send, sendConfigUpdate]
    );

    const onTextFieldChange = React.useCallback((event: Event | React.FormEvent<HTMLElement>) => {
        const target = event.target as HTMLInputElement;
        const value = target.value;
        setNewKeywordField(value);
    }, []);

    const onAddKeyword = React.useCallback(() => {
        // skip if the field is empty
        if (!newKeywordField) {
            return;
        }
        const newKeyword: KeywordDefinition = { id: uuid(), keyword: newKeywordField, isChecked: true, isCustom: true };
        setKeywords(prev => [...prev, newKeyword]);
        setNewKeywordField("");

        log("onAddKeyword", `Sending keyword '${newKeywordField}' to the extension backend`);
        send({ id: newKeyword.id, isChecked: true, value: newKeyword.keyword });
        sendConfigUpdate({ id: newKeyword.id, isChecked: true, value: newKeyword.keyword, updateType: "add" });
    }, [newKeywordField, setKeywords, log, send, sendConfigUpdate]);

    const onTextFieldKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
            if (event.key === "Enter") {
                onAddKeyword();
            }
        },
        [onAddKeyword]
    );

    const onRemoveKeyword = React.useCallback(
        (keyword: KeywordDefinition) => {
            setKeywords(prev => prev.filter(kw => kw.id !== keyword.id));
            // only send the removal if the keyword was enabled
            if (keyword.isChecked) {
                log("onRemoveKeyword", `Removing keyword enabled '${keyword.keyword}' with id: ${keyword.id}`);
                send({ id: keyword.id, isChecked: false, value: keyword.keyword });
            }
            sendConfigUpdate({ id: keyword.id, isChecked: false, value: keyword.keyword, updateType: "remove" });
        },
        [setKeywords, log, send, sendConfigUpdate]
    );

    return (
        <Flex direction="column" wrap="wrap" justifyContent="space-evenly">
            {keywords.map(keyword => {
                return (
                    <Flex key={`kw_${keyword.id}`} direction="row" wrap="wrap" justifyContent="flex-start">
                        <VSCodeCheckbox
                            checked={keyword.isChecked}
                            name={`kw_${keyword.id}`}
                            disabled={isPending}
                            onChange={onCheckboxChange}>
                            {keyword.keyword}
                        </VSCodeCheckbox>
                        <VSCodeButton
                            style={{ marginLeft: "auto" }}
                            appearance="icon"
                            aria-label="Remove keyword"
                            disabled={isPending}
                            onClick={() => {
                                onRemoveKeyword(keyword);
                            }}>
                            <span className="codicon codicon-close"></span>
                        </VSCodeButton>
                    </Flex>
                );
            })}

            <Flex direction="row" wrap="wrap" justifyContent="flex-start" style={{ marginTop: "2rem" }}>
                <VSCodeTextField
                    value={newKeywordField}
                    onInput={onTextFieldChange}
                    placeholder="\.*REGEX.*/"
                    disabled={isPending}
                    onKeyDown={onTextFieldKeyDown}>
                    Add a new keyword
                </VSCodeTextField>
                <VSCodeButton
                    onClick={onAddKeyword}
                    disabled={isPending}
                    style={{ marginLeft: "auto", maxHeight: "26px", alignSelf: "flex-end" }}>
                    Add
                    <span slot="start" className="codicon codicon-add"></span>
                </VSCodeButton>
            </Flex>
        </Flex>
    );
};
