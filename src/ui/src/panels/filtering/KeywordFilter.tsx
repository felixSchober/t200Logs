import * as React from "react";
import { VSCodeButton, VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { Flex } from "../../common/Flex";
import { useSendAndReceive } from "../../service/useSendAndReceive";
import { v4 as uuid } from "uuid";
import { useLogger } from "../../service/useLogger";

type KeywordDefinition = {
    /**
     * The unique identifier for the keyword
     */
    id: string;

    /**
     * The keyword to filter on
     */
    keyword: string;

    /**
     * Whether the keyword is enabled
     */
    isChecked: boolean;

    /**
     * Whether the keyword is a custom keyword that was added by the user through the UI
     */
    isCustom: boolean;
};

const predefinedKeywords: KeywordDefinition[] = [
    { id: uuid(), keyword: "Auth|auth", isChecked: false, isCustom: false },
    { id: uuid(), keyword: "CDL|cdl", isChecked: false, isCustom: false },
    { id: uuid(), keyword: "oneauth|OneAuth", isChecked: false, isCustom: false },
    { id: uuid(), keyword: "AcquireToken|acquireToken", isChecked: false, isCustom: false },
    { id: uuid(), keyword: "auth-login-page", isChecked: false, isCustom: false },
];

export const KeywordFilter: React.FC = () => {
    const { log, logError } = useLogger("KeywordFilter");
    const [keywords, setKeywords] = React.useState<KeywordDefinition[]>(predefinedKeywords);
    const [newKeywordField, setNewKeywordField] = React.useState("");
    const { send, isPending } = useSendAndReceive("filterCheckboxStateChange", "updateNumberOfActiveFilters");

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
                } else {
                    logError("onCheckboxChange", `Could not find keyword with id '${keywordId}' and name '${name}'`);
                }
                return [...prev];
            });
        },
        [log, logError]
    );

    const onTextFieldChange = React.useCallback((event: Event | React.FormEvent<HTMLElement>) => {
        const target = event.target as HTMLInputElement;
        const value = target.value;
        setNewKeywordField(value);
    }, []);

    const onAddKeyword = () => {
        // skip if the field is empty
        if (!newKeywordField) {
            return;
        }
        const newKeyword: KeywordDefinition = { id: uuid(), keyword: newKeywordField, isChecked: true, isCustom: true };
        setKeywords(prev => [...prev, newKeyword]);
        setNewKeywordField("");

        log("onAddKeyword", `Sending keyword '${newKeywordField}' to the extension backend`);
        send({ id: newKeyword.id, isChecked: true, value: newKeyword.keyword });
    };

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
        },
        [setKeywords, log, send]
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
                    onChange={onTextFieldChange}
                    placeholder="\.*REGEX.*/"
                    disabled={isPending}
                    onKeyDown={onTextFieldKeyDown}>
                    Add a new keyword
                </VSCodeTextField>
                <VSCodeButton onClick={onAddKeyword} disabled={isPending} style={{ marginLeft: "auto" }}>
                    Add
                    <span slot="start" className="codicon codicon-add"></span>
                </VSCodeButton>
            </Flex>
        </Flex>
    );
};

