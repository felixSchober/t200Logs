import * as React from "react";
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react";
import { Flex } from "../../common/Flex";
import { useSendAndReceive } from "../../service/useSendAndReceive";

export const LogLevelFilter: React.FC = () => {
    const [errorFilterEnabled, setErrorFilterEnabled] = React.useState(true);
    const [warningFilterEnabled, setWarningFilterEnabled] = React.useState(true);
    const [infoFilterEnabled, setInfoFilterEnabled] = React.useState(true);
    const [debugFilterEnabled, setDebugFilterEnabled] = React.useState(true);
    const { send } = useSendAndReceive("filterLogLevel", "updateNumberOfActiveFilters", -1, true);

    const onCheckboxChange = React.useCallback((event: Event | React.FormEvent<HTMLElement>) => {
        const target = event.target as HTMLInputElement;
        const value = target.checked;
        const name = target.name;

        switch (name) {
            case "error":
                setErrorFilterEnabled(value);
                send({ isChecked: value, logLevel: "error" });
                break;
            case "warning":
                setWarningFilterEnabled(value);
                send({ isChecked: value, logLevel: "warning" });
                break;
            case "info":
                setInfoFilterEnabled(value);
                send({ isChecked: value, logLevel: "info" });
                break;
            case "debug":
                setDebugFilterEnabled(value);
                send({ isChecked: value, logLevel: "debug" });
                break;
            default:
                break;
        }
    }, []);

    return (
        <Flex direction="row" wrap="wrap" justifyContent="space-evenly">
            <VSCodeCheckbox checked={errorFilterEnabled} name="error" onChange={onCheckboxChange}>
                Error
            </VSCodeCheckbox>
            <VSCodeCheckbox checked={warningFilterEnabled} name="warning" onChange={onCheckboxChange}>
                Warning
            </VSCodeCheckbox>
            <VSCodeCheckbox checked={infoFilterEnabled} name="info" onChange={onCheckboxChange}>
                Info
            </VSCodeCheckbox>
            <VSCodeCheckbox checked={debugFilterEnabled} name="debug" onChange={onCheckboxChange}>
                Debug
            </VSCodeCheckbox>
        </Flex>
    );
};

