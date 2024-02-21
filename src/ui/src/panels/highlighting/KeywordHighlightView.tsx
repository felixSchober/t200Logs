import * as React from "react";
import {
    VSCodeDivider,
    VSCodePanelTab,
    VSCodePanelView,
    VSCodeBadge,
    VSCodeButton,
    VSCodeCheckbox,
    VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react";
import { Flex } from "../../common/Flex";
import { useMessageSubscription } from "../../service/useMessageSubscription";
import { v4 as uuid } from "uuid";
import { useLogger } from "../../service/useLogger";
import { useSendAndReceive } from "../../service/useSendAndReceive";

type KeywordHighlightDefinition = {
    /**
     * The unique identifier for the keyword
     */
    id: string;

    /**
     * The keyword to highlight
     */
    keyword: string;

    /**
     * The color to use for highlighting
     */
    color: string;

    /**
     * Whether the keyword is enabled
     */
    isChecked: boolean;

    /**
     * Whether the keyword is a custom keyword that was added by the user through the UI
     */
    isCustom: boolean;
};

const createColor = () => {
    return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
};

export const KeywordHighlightView: React.FC = () => {
    const { log, logError } = useLogger("KeywordHighlightView");
    const [keywords, setKeywords] = React.useState<KeywordHighlightDefinition[]>([]);
    const [newKeywordField, setNewKeywordField] = React.useState("");

    const { send, isPending } = useSendAndReceive("keywordHighlightStateChange", "messageAck", 4000);
    const activeKeywords = useMessageSubscription("updateNumberOfHighlightedKeywords");
    const keywordsFromConfiguration = useMessageSubscription("setKeywordHighlightsFromConfiguration");

    React.useEffect(() => {
        if (keywordsFromConfiguration && keywordsFromConfiguration.length > 0) {
            setKeywords(prev => {
                const newKeywords: KeywordHighlightDefinition[] = keywordsFromConfiguration.map(kw => {
                    return {
                        ...kw.keywordDefinition,
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
                        `Sending highlight '${keyword.keyword}' with id: ${keywordId} and value: ${value} to the extension backend`
                    );
                    send({ isChecked: value, keywordDefinition: keyword });
                } else {
                    logError("onCheckboxChange", `Could not find highlight with id '${keywordId}' and name '${name}'`);
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
        const newKeyword: KeywordHighlightDefinition = {
            id: uuid(),
            keyword: newKeywordField,
            isChecked: true,
            isCustom: true,
            color: createColor(),
        };
        setKeywords(prev => [...prev, newKeyword]);
        setNewKeywordField("");

        log("onAddKeyword", `Sending highlight '${newKeywordField}' to the extension backend`);
        send({ isChecked: true, keywordDefinition: newKeyword });
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
        (keyword: KeywordHighlightDefinition) => {
            setKeywords(prev => prev.filter(kw => kw.id !== keyword.id));
            // only send the removal if the keyword was enabled
            if (keyword.isChecked) {
                log("onRemoveKeyword", `Removing highlight enabled '${keyword.keyword}' with id: ${keyword.id}`);
                send({ isChecked: false, keywordDefinition: keyword });
            }
        },
        [setKeywords, log, send]
    );

    return (
        <>
            <VSCodePanelTab id="tab-3">
                Keywords {activeKeywords && activeKeywords > 0 ? <VSCodeBadge>{activeKeywords}</VSCodeBadge> : null}
            </VSCodePanelTab>
            <VSCodePanelView id="view-3">
                <Flex direction="column" hFill>
                    <h2>Keyword Highlights</h2>
                    <p>Highlight keywords in the log files by adding to this list</p>

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
                                    <span
                                        style={{
                                            backgroundColor: keyword.color,
                                            width: "1rem",
                                            height: "1rem",
                                            borderRadius: "50%",
                                            marginLeft: "auto",
                                            alignSelf: "center",
                                        }}></span>
                                    <VSCodeButton
                                        style={{ marginLeft: "1rem" }}
                                        appearance="icon"
                                        aria-label="Remove keyword highlight"
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
                            <VSCodeButton
                                onClick={onAddKeyword}
                                disabled={isPending}
                                style={{ marginLeft: "auto", maxHeight: "26px", alignSelf: "flex-end" }}>
                                Add
                                <span slot="start" className="codicon codicon-add"></span>
                            </VSCodeButton>
                        </Flex>
                    </Flex>
                </Flex>
            </VSCodePanelView>
        </>
    );
};










