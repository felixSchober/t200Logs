/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";

import { Flex } from "../../common/Flex";
import { useDebounce } from "../../common/useDebounce";
import { useExtensionState } from "../../service/useExtensionState";
import { useLogger } from "../../service/useLogger";
import { useSendAndReceive } from "../../service/useSendAndReceive";
import { INITIAL_EXTENSION_STATE } from "../../vscode/ExtensionState";

export const DisplaySettings: React.FC = () => {
    const [displaySettings, setDisplaySettings] = useExtensionState("displaySettingState");
    const { log, logError } = useLogger("DisplaySettings");
    const debouncedDisplaySettings = useDebounce(displaySettings, 500);

    const { send, isPending } = useSendAndReceive("displaySettingsChanged", "messageAck");

    const onCheckboxChange = React.useCallback(
        (event: Event | React.FormEvent<HTMLElement>) => {
            const target = event.target as HTMLInputElement;
            const value = target.checked;
            const name = target.name;

            switch (name) {
                case "displayFileNames":
                    setDisplaySettings(prev => ({ ...prev, displayFileNames: value }));
                    break;
                case "displayGuids":
                    setDisplaySettings(prev => ({ ...prev, displayGuids: value }));
                    break;
                case "displaySeverityHighlight":
                    setDisplaySettings(prev => ({ ...prev, displayLogLevels: value }));
                    break;
                case "displayReadableDates":
                    setDisplaySettings(prev => ({ ...prev, displayReadableDates: value }));
                    break;
                case "displayInlineTime":
                    setDisplaySettings(prev => ({ ...prev, displayDatesInLine: value }));
                    break;
                default:
                    logError("onCheckboxChange", `Unknown checkbox name: ${name}`);
                    break;
            }
            log("onCheckboxChange", `New display setting ${name} is ${value}`);
        },
        [log, logError, setDisplaySettings]
    );

    React.useEffect(() => {
        log("useEffect", "Sending display settings to the extension backend");
        send({
            ...debouncedDisplaySettings,
        });
    }, [debouncedDisplaySettings, send, log]);

    return (
        <Flex direction="row" wrap="wrap" justifyContent="flex-start">
            <VSCodeCheckbox
                disabled={isPending}
                checked={displaySettings.displayFileNames ?? INITIAL_EXTENSION_STATE.displaySettingState.displayFileNames}
                name="displayFileNames"
                onChange={onCheckboxChange}>
                Display file names
            </VSCodeCheckbox>
            <VSCodeCheckbox
                disabled={isPending}
                checked={displaySettings.displayGuids ?? INITIAL_EXTENSION_STATE.displaySettingState.displayGuids}
                name="displayGuids"
                onChange={onCheckboxChange}>
                Display GUIDs
            </VSCodeCheckbox>
            <VSCodeCheckbox
                disabled={isPending}
                checked={displaySettings.displayLogLevels ?? INITIAL_EXTENSION_STATE.displaySettingState.displayLogLevels}
                name="displaySeverityHighlight"
                onChange={onCheckboxChange}>
                Display severity highlight
            </VSCodeCheckbox>
            <VSCodeCheckbox
                disabled={isPending}
                checked={displaySettings.displayReadableDates ?? INITIAL_EXTENSION_STATE.displaySettingState.displayReadableDates}
                name="displayReadableDates"
                onChange={onCheckboxChange}>
                Display readable dates
            </VSCodeCheckbox>
            <VSCodeCheckbox
                disabled={isPending}
                checked={displaySettings.displayDatesInLine ?? INITIAL_EXTENSION_STATE.displaySettingState.displayDatesInLine}
                name="displayInlineTime"
                onChange={onCheckboxChange}>
                Display inline time
            </VSCodeCheckbox>
        </Flex>
    );
};
