import * as React from "react";
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react";
import { Flex } from "../../common/Flex";
import { useSendAndReceive } from "../../service/useSendAndReceive";
import { useDebounce } from "../../common/useDebounce";
import { useLogger } from "../../service/useLogger";

type DisplaySettingsState = {
    displayFileNames: boolean;
    displayGuids: boolean;
    displaySeverityHighlight: boolean;
    displayReadableDates: boolean;
    displayInlineTime: boolean;
};

const initialDisplaySettingsState: DisplaySettingsState = {
    displayFileNames: true,
    displayGuids: true,
    displaySeverityHighlight: false,
    displayReadableDates: false,
    displayInlineTime: false,
};

export const DisplaySettings: React.FC = () => {
    const [displaySettings, setDisplaySettings] = React.useState<DisplaySettingsState>(initialDisplaySettingsState);
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
                    setDisplaySettings(prev => ({ ...prev, displaySeverityHighlight: value }));
                    break;
                case "displayReadableDates":
                    setDisplaySettings(prev => ({ ...prev, displayReadableDates: value }));
                    break;
                case "displayInlineTime":
                    setDisplaySettings(prev => ({ ...prev, displayInlineTime: value }));
                    break;
                default:
                    logError("onCheckboxChange", `Unknown checkbox name: ${name}`);
                    break;
            }
            log("onCheckboxChange", `New display setting ${name} is ${value}`);
        },
        [log, logError]
    );

    React.useEffect(() => {
        log("useEffect", "Sending display settings to the extension backend");
        send({
            displayDatesInLine: debouncedDisplaySettings.displayInlineTime,
            displayFileNames: debouncedDisplaySettings.displayFileNames,
            displayGuids: debouncedDisplaySettings.displayGuids,
            displayLogLevels: debouncedDisplaySettings.displaySeverityHighlight,
            displayReadableDates: debouncedDisplaySettings.displayReadableDates,
        });
    }, [debouncedDisplaySettings, send, log]);

    return (
        <Flex direction="row" wrap="wrap" justifyContent="flex-start">
            <VSCodeCheckbox
                disabled={isPending}
                checked={displaySettings.displayFileNames}
                name="displayFileNames"
                onChange={onCheckboxChange}>
                Display file names
            </VSCodeCheckbox>
            <VSCodeCheckbox disabled={isPending} checked={displaySettings.displayGuids} name="displayGuids" onChange={onCheckboxChange}>
                Display GUIDs
            </VSCodeCheckbox>
            <VSCodeCheckbox
                disabled={isPending}
                checked={displaySettings.displaySeverityHighlight}
                name="displaySeverityHighlight"
                onChange={onCheckboxChange}>
                Display severity highlight
            </VSCodeCheckbox>
            <VSCodeCheckbox
                disabled={isPending}
                checked={displaySettings.displayReadableDates}
                name="displayReadableDates"
                onChange={onCheckboxChange}>
                Display readable dates
            </VSCodeCheckbox>
            <VSCodeCheckbox
                disabled={isPending}
                checked={displaySettings.displayInlineTime}
                name="displayInlineTime"
                onChange={onCheckboxChange}>
                Display inline time
            </VSCodeCheckbox>
        </Flex>
    );
};


