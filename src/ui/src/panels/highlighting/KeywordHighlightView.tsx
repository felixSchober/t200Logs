/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { VSCodeBadge, VSCodeButton, VSCodeCheckbox, VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import { v4 as uuid } from "uuid";

import { ColorPicker } from "../../common/ColorPicker";
import { Flex } from "../../common/Flex";
import { useLogger } from "../../service/useLogger";
import { useMessageSubscription } from "../../service/useMessageSubscription";
import { useSendAndReceive } from "../../service/useSendAndReceive";

import { NewKeywordHighlight } from "./NewKeywordHighlight";

type KeywordHighlightDefinition = {
    /**
     * The unique identifier for the keyword.
     */
    id: string;

    /**
     * The keyword to highlight.
     */
    keyword: string;

    /**
     * The color to use for highlighting.
     */
    color: string;

    /**
     * Whether the keyword is enabled.
     */
    isChecked: boolean;

    /**
     * Whether the keyword is a custom keyword that was added by the user through the UI.
     */
    isCustom: boolean;
};

export const KeywordHighlightView: React.FC = () => {
    const { log, logError } = useLogger("KeywordHighlightView");
    const [keywords, setKeywords] = React.useState<KeywordHighlightDefinition[]>([]);

    const { send, isPending } = useSendAndReceive("keywordHighlightStateChange", "messageAck", 4000);
    const { send: sendConfigUpdate } = useSendAndReceive("updateKeywordHighlightConfiguration", "messageAck");
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
                    sendConfigUpdate({ keywordDefinition: keyword, updateType: "update" });
                } else {
                    logError("onCheckboxChange", `Could not find highlight with id '${keywordId}' and name '${name}'`);
                }
                return [...prev];
            });
        },
        [log, logError, send, sendConfigUpdate]
    );

    const onAddKeyword = React.useCallback(
        (keyword: string, color: string) => {
            // skip if the field is empty
            if (!keyword) {
                return;
            }
            const newKeyword: KeywordHighlightDefinition = {
                id: uuid(),
                keyword,
                isChecked: true,
                isCustom: true,
                color,
            };
            setKeywords(prev => [...prev, newKeyword]);

            log("onAddKeyword", `Sending highlight '${keyword}' to the extension backend`);
            send({ isChecked: true, keywordDefinition: newKeyword });
            sendConfigUpdate({ keywordDefinition: newKeyword, updateType: "add" });
        },
        [setKeywords, log, send, sendConfigUpdate]
    );

    const onRemoveKeyword = React.useCallback(
        (keyword: KeywordHighlightDefinition) => {
            setKeywords(prev => prev.filter(kw => kw.id !== keyword.id));
            // only send the removal if the keyword was enabled
            if (keyword.isChecked) {
                log("onRemoveKeyword", `Removing highlight enabled '${keyword.keyword}' with id: ${keyword.id}`);
                send({ isChecked: false, keywordDefinition: keyword });
            }
            sendConfigUpdate({ keywordDefinition: keyword, updateType: "remove" });
        },
        [setKeywords, log, sendConfigUpdate, send]
    );

    const getOnKeywordColorChange = React.useCallback(
        (keyword: KeywordHighlightDefinition) => {
            return (color: string) => {
                setKeywords(prev => {
                    const kw = prev.find(kw => kw.id === keyword.id);
                    if (kw) {
                        kw.color = color;
                        log("onKeywordColorChange", `Changing color '${color}' for highlight '${keyword.keyword}'`);

                        // only send something to the backend if the keyword is enabled
                        if (kw.isChecked) {
                            // we first need to disable the keyword and then re-enable it with the new color
                            send({ isChecked: false, keywordDefinition: kw });
                            send({ isChecked: true, keywordDefinition: kw });
                        }
                        sendConfigUpdate({ keywordDefinition: kw, updateType: "update" });
                    }
                    return [...prev];
                });
            };
        },
        [setKeywords, log, send, sendConfigUpdate]
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
                                    <ColorPicker
                                        initialColor={keyword.color}
                                        onColorChange={getOnKeywordColorChange(keyword)}
                                        key={`kw_${keyword.id}_color`}
                                    />
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

                        <NewKeywordHighlight isPending={isPending} onAddNewKeyword={onAddKeyword} />
                    </Flex>
                </Flex>
            </VSCodePanelView>
        </>
    );
};

