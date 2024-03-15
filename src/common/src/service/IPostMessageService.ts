/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { CommandIdToData, GetCommandById, MessageCommand } from "../postMessage/MessageCommands";
import { CommandId } from "../postMessage/PostMessageSchema";

import { HandleEvent } from "./PostMessageServiceBase";

/**
 * Service for sending and receiving messages between the webview and the extension.
 */
export interface IPostMessageService {
    /**
     * Registers a handler for a specific command.
     * @param commandId The command to register a handler for.
     * @param handler The handler to call when the command is received.
     * @returns A function to unregister the handler.
     */
    registerMessageHandler<T extends CommandId>(commandId: T, handler: HandleEvent<CommandIdToData<T>>): () => void;

    /**
     * Unregisters a handler for a specific command.
     * @param commandId The command to unregister the handler for.
     * @param handler The handler to unregister.
     * @returns Void.
     */
    unregisterMessageHandler<T extends MessageCommand>(commandId: T["command"], handler: HandleEvent<T["data"]>): void;

    /**
     * Sends a message to the extension and waits for a response.
     * @param command The command to send to the extension.
     * @param expectResponseId The command id to expect as a response.
     * @param timeout The timeout in milliseconds to wait for a response. If the timeout is reached the promise will be rejected. If no timeout is provided, there is no timeout.
     * @returns A promise that resolves when the response is received with the response data.
     * @template TCommandId The command id of the command to send. E.g. `"getSummary"`.
     * @template TResponseId The command id of the response to expect. E.g. `"getSummaryResponse"`.
     */
    sendAndReceive<TCommandId extends CommandId, TResponseId extends CommandId>(
        command: GetCommandById<TCommandId>,
        expectResponseId: TResponseId,
        timeout?: number
    ): Promise<CommandIdToData<TResponseId>>;

    /**
     * Acknowledges a message by sending a messageAck command to the webview.
     * @param id The id of the message to acknowledge.
     */
    acknowledgeMessage(id: string): void;

    /**
     * Sends a message to the extension and forgets about it. No response is expected.
     *
     * If you need to know if the message was received and processed by the extension, use {@link sendAndReceive} instead.
     * @param command The command to send to the extension.
     * @param requestId The id of the message that the UI sent to the extension. If no id is provided, a new id will be generated.
     */
    sendAndForget(command: MessageCommand, requestId?: string): void;
}
