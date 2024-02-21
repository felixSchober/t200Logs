import { CommandId, CommandIdToData } from "@t200logs/common";
import { useVSCodeApi } from "../vscode/useVSCodeApi";
import * as React from "react";
import { useLogger } from "./useLogger";

/**
 * A hook that subscribes to a message from the webview
 * @param messageId The id of the message to subscribe to
 * @returns The response from the webview or null if no response has been received yet.
 * @example const activeFilters = useMessageSubscription("updateNumberOfActiveFilters");
 */
export const useMessageSubscription = <T extends CommandId>(messageId: T): CommandIdToData<T> | null => {
    const { messageService } = useVSCodeApi();
    const { log } = useLogger("useMessageSubscription");
    const removeHandlerRef = React.useRef<(() => void) | undefined>(undefined);
    const [response, setResponse] = React.useState<CommandIdToData<T> | null>(null);

    React.useEffect(() => {
        if (!removeHandlerRef.current) {
            log("useEffect", `Registering message handler for ${messageId}`);
            removeHandlerRef.current = messageService.registerMessageHandler(messageId, (data: CommandIdToData<T>) => {
                setResponse(data);
            });
        }
        return () => {
            if (removeHandlerRef.current) {
                log("useEffect", `Removing message handler for ${messageId}`);
                removeHandlerRef.current();
                removeHandlerRef.current = undefined;
            }
        };
    }, [messageService, messageId]);

    return response;
};

