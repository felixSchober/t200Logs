/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { CommandId, CommandIdToData, GetCommandById } from "@t200logs/common";
import * as React from "react";

import { useVSCodeApi } from "../vscode/useVSCodeApi";

/**
 * A function that sends a message command to the webview.
 */
type SendMethod<T extends CommandId> = (command: CommandIdToData<T>) => void;

type HookReturn<T extends CommandId, TResponse> = {
    /**
     * A function that sends a message command to the webview.
     */
    send: SendMethod<T>;

    /**
     * A boolean indicating if the message is pending and has not received a response.
     */
    isPending: boolean;

    /**
     * The response from the webview or null if no response has been received yet.
     */
    response: TResponse | null;
};

/**
 * A hook that provides a method to send a message to the webview and wait for a response.
 * @param messageId The id of the message to send.
 * @param responseId The id of the message to receive.
 * @param timeout The time in milliseconds to wait for a response. If -1, then it will wait indefinitely.
 * @returns A hook that sends a message to the webview and waits for a response.
 */
export const useSendAndReceive = <TMessageId extends CommandId, TResponseId extends CommandId>(
    messageId: TMessageId,
    responseId: TResponseId,
    timeout: number = -1
): HookReturn<TMessageId, CommandIdToData<TResponseId>> => {
    const { messageService } = useVSCodeApi();
    const [isPending, setIsPending] = React.useState(false);
    const [response, setResponse] = React.useState<CommandIdToData<TResponseId> | null>(null);

    const send: SendMethod<TMessageId> = React.useCallback(
        (data: CommandIdToData<TMessageId>) => {
            setIsPending(true);
            const sendAndWait = async () => {
                const command: GetCommandById<TMessageId> = {
                    command: messageId,
                    data,
                };
                try {
                    const response = await messageService.sendAndReceive(command, responseId, timeout);
                    setResponse(response);
                } catch (error) {
                    console.error(error);
                } finally {              
                    setIsPending(false);
                }
            };
            void sendAndWait();
        },
        [messageService, messageId, responseId, timeout]
    );

    return React.useMemo(() => {
        return {
            send,
            isPending,
            response,
        };
    }, [send, isPending, response]);
};


