/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { VSCodeCheckbox, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import * as React from "react";

import { Flex } from "../../common/Flex";
import { useLogger } from "../../service/useLogger";
import { useMessageSubscription } from "../../service/useMessageSubscription";
import { useSendAndReceive } from "../../service/useSendAndReceive";
import { LogFileListWithState } from "@t200logs/common/src/model/LogFileList";

export const FileFilter: React.FC = () => {
    const { log, logError } = useLogger("FileFilter");
    const [files, setFiles] = React.useState<LogFileListWithState>([]);

    const { send } = useSendAndReceive("updateFileFilterCheckboxState", "messageAck");
    const fileStateFromConfiguration = useMessageSubscription("setFileListFromConfiguration");
    const fileList = useMessageSubscription("setFileList");

    const isPending = fileList === null;

    // Updates the state when the file list is received from the logs content provider.
    // This is always the source of truth for the file list.
    React.useEffect(() => {
        if (fileList && fileList.length > 0) {
            setFiles(prev => {
                const newState: LogFileListWithState = fileList.map(file => {
                    const existingFile = prev.find(f => f.fileName === file.fileName);

                    return {
                        fileName: file.fileName,
                        fileType: file.fileType,
                        numberOfEntries: file.numberOfEntries,
                        numberOfFilteredEntries: file.numberOfFilteredEntries,
                        isEnabled: existingFile?.isEnabled ?? true,
                    };
                });
                return newState;
            });
        }
    }, [fileList]);

    // Updates the state when the file list is received from the project configuration.
    React.useEffect(() => {
        // When we get the file list from the configuration, we need to merge the state.
        // This is tricky because the configuration might have a different set of files than the current state.
        // To make sure we don't remove or add files we will do a outer join on the file names.
        // If a file is in the state and not in the configuration, we will keep the state.
        // If a file is in the configuration and not in the state, we will add it to the state but it will be disabled (no log entries).
        if (fileStateFromConfiguration && fileStateFromConfiguration.length > 0) {
            setFiles(prev => {
                const newState: LogFileListWithState = [...prev];

                for (const fileName of fileStateFromConfiguration) {
                    const existingFile = newState.find(f => f.fileName === fileName);

                    // If the file is in the state, we will just update the state.
                    if (existingFile) {
                        existingFile.isEnabled = false;
                    } else {
                        // file not in state - add a new file to the state with dummy values
                        newState.push({
                            fileName,
                            fileType: "unknown",
                            isEnabled: false,
                            numberOfEntries: 0,
                            numberOfFilteredEntries: 0,
                        });
                    }
                }

                // now, we iterate over the prev state and add any files that are not in the configuration
                // this is the outer join part
                for (const file of prev) {
                    if (!fileStateFromConfiguration.find(f => f === file.fileName)) {
                        newState.push(file);
                    }
                }

                return newState;
            });
        }
    }, [fileStateFromConfiguration]);

    const onCheckboxChange = React.useCallback(
        (event: Event | React.FormEvent<HTMLElement>) => {
            const target = event.target as HTMLInputElement;
            const value = target.checked;
            const name = target.name;

            const fileName = name.split("_")[1];

            setFiles(prev => {
                const file = prev.find(f => f.fileName === fileName);
                if (file) {
                    file.isEnabled = value;
                    log("onCheckboxChange", `Sending file '${file.fileName}' and value: ${value} to the extension backend`);
                    send(file);
                } else {
                    logError("onCheckboxChange", `Could not find file name '${fileName}'`);
                }
                return [...prev];
            });
        },
        [log, logError, send]
    );

    return (
        <Flex direction="column" wrap="wrap" justifyContent="space-evenly">
            {isPending && <VSCodeProgressRing />}
            {files.map(file => {
                return (
                    <Flex key={`file_${file.fileName}`} direction="row" wrap="wrap" justifyContent="flex-start">
                        <VSCodeCheckbox
                            checked={file.isEnabled}
                            name={`file_${file.fileName}`}
                            disabled={file.numberOfFilteredEntries === 0 && file.isEnabled === true} // disable the checkbox if there are no entries and it is enabled
                            onChange={onCheckboxChange}>
                            {file.fileName}
                        </VSCodeCheckbox>
                    </Flex>
                );
            })}
        </Flex>
    );
};



