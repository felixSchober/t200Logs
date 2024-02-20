import { v4 as uuid } from "uuid";
import { z } from "zod";
import { CommandIdToData, MessageCommand, GetCommandById, PostMessageCommand } from "../MessageCommands";
import { MessageSchemaMap } from "../MessageSchemaMap";
import { CommandId, PostMessageSchema } from "../PostMessageSchema";
import { IPostMessageService } from "./IPostMessageService";

/**
 * A function that can be called to respond to a message with a new message.
 */
export type PostMessageEventRespondFunction = (response: MessageCommand) => void;

/**
 * A function that handles when a message with a specific command is received.
 * @param data The data received with the message
 * @param respond A function to call to respond to the message with a new message.
 * @template T The type of the data received with the message
 */
export type HandleEvent<T> = (data: T, respond: PostMessageEventRespondFunction) => void;

/**
 * Combines a list of event listeners for a specific command.
 * @template TCommandId The id of the command to handle.
 */
type CommandHandlingData<TCommandId extends CommandId> = {
    /**
     * The schema used to handle the data property of the message.
     */
    commandSchema: (typeof MessageSchemaMap)[TCommandId];

    /**
     * The event listeners to notify when a message with the command id is received.
     */
    eventListeners: HandleEvent<CommandIdToData<TCommandId>>[];
};

type EventListenerMap = {
    [K in CommandId]: CommandHandlingData<K>;
};

/**
 * General implementation of a post message service used to communicate between the webview and the extension.
 * This class is meant to be extended by the webview and the extension to implement the specific communication methods.
 *
 * It provides methods to send and receive messages and to register and unregister event listeners for specific commands.
 * All data is validated using zod schemas to ensure that the data is valid.
 * It is typed according to the commands and schemas defined in the {@link MessageCommand} and {@link MessageSchemaMap}.
 */
export abstract class PostMessageServiceBase implements IPostMessageService {
    /**
     * Map to keep track of received messages so that we can resolve the promise.
     * The key is the message id and the value is the resolve function.
     */
    private readonly receivedMessages: Map<string, (response: unknown) => void> = new Map();

    /**
     * Map to keep track of event listeners
     * The key is the command id and the value is an array of event listeners.
     */
    private readonly eventListeners: EventListenerMap = {
        filterCheckboxStateChange: {
            commandSchema: MessageSchemaMap.filterCheckboxStateChange,
            eventListeners: [],
        },
        logErrorMessage: {
            commandSchema: MessageSchemaMap.logErrorMessage,
            eventListeners: [],
        },
        logMessage: {
            commandSchema: MessageSchemaMap.logMessage,
            eventListeners: [],
        },
        getSummary: {
            commandSchema: MessageSchemaMap.getSummary,
            eventListeners: [],
        },
        getSummaryResponse: {
            commandSchema: MessageSchemaMap.getSummaryResponse,
            eventListeners: [],
        },
        updateNumberOfActiveFilters: {
            commandSchema: MessageSchemaMap.updateNumberOfActiveFilters,
            eventListeners: [],
        },
        displaySettingsChanged: {
            commandSchema: MessageSchemaMap.displaySettingsChanged,
            eventListeners: [],
        },
        filterLogLevel: {
            commandSchema: MessageSchemaMap.filterLogLevel,
            eventListeners: [],
        },
        filterNoEventTime: {
            commandSchema: MessageSchemaMap.filterNoEventTime,
            eventListeners: [],
        },
        filterSessionId: {
            commandSchema: MessageSchemaMap.filterSessionId,
            eventListeners: [],
        },
        filterTime: {
            commandSchema: MessageSchemaMap.filterTime,
            eventListeners: [],
        },
        keywordHighlightStateChange: {
            commandSchema: MessageSchemaMap.keywordHighlightStateChange,
            eventListeners: [],
        },
        openLogsDocument: {
            commandSchema: MessageSchemaMap.openLogsDocument,
            eventListeners: [],
        },
        updateTimeFilters: {
            commandSchema: MessageSchemaMap.updateTimeFilters,
            eventListeners: [],
        },
        messageAck: {
            commandSchema: MessageSchemaMap.messageAck,
            eventListeners: [],
        },
    };

    /**
     * Method to start listening for post messages.
     */
    protected abstract startListening(): void;

    /**
     * Handles the message received from the extension by resolving the promise for the message id and
     * notifying all event listeners for the command id.
     *
     * Call this method in the implementation of the {@link startListening} method.
     * @param event The message event received from the extension.
     * @returns void
     */
    protected onMessageReceived(event: MessageEvent<unknown>) {
        const messageData = event;
        const parsedData = PostMessageSchema.safeParse(messageData);

        if (!parsedData.success) {
            debugger;
            console.error("Invalid message received", parsedData.error);
            this.internalLogErrorMessage(
                "PostMessageService.onMessageReceived",
                `Invalid message received. Message: '${JSON.stringify(event)}' Parse error: '${parsedData.error.toString()}'`
            );
            return;
        }

        const messageId = parsedData.data.id;
        this.internalLogMessage("PostMessageService.onMessageReceived", `Received message with id: ${messageId}`);

        // Check if we have a promise for the message id we can resolve
        const resolve = this.receivedMessages.get(messageId);
        if (resolve) {
            resolve(parsedData.data.data);
            this.receivedMessages.delete(messageId);
        }

        // Notify all event listeners for the command id
        const message = parsedData.data;
        const commandId = message.command;
        const eventListeners = this.eventListeners[commandId].eventListeners;
        const schema = this.eventListeners[commandId].commandSchema;

        // const parsedMessage = this.parseMessageData(message.command, message.data, schema);
        const parsedMessageData = this.parseMessageData(message.command, message.data, schema);
        const respond: PostMessageEventRespondFunction = (response: MessageCommand) => {
            this.replyToMessage(response, messageId);
        };

        for (const listener of eventListeners) {
            const listenerForData = listener as HandleEvent<typeof parsedMessageData>;
            listenerForData(parsedMessageData, respond);
        }
    }

    /**
     * Parses the message data using the provided schema.
     * Throws an error if the data cannot be parsed according to the schema.
     * @param message The message to parse
     * @param schema The schema to use to parse the message data
     * @returns The parsed message
     */
    private parseMessageData<T extends MessageCommand>(commandId: T["command"], data: unknown, schema: z.Schema<T["data"]>): T["data"] {
        const parsedData = schema.safeParse(data);
        if (!parsedData.success) {
            throw new Error(`Invalid message data received for command: ${commandId}`);
        }
        return parsedData.data;
    }

    /**
     * Registers a handler for a specific command.
     * @param commandId The command to register a handler for
     * @param handler The handler to call when the command is received
     * @returns A function to unregister the handler
     */
    public registerMessageHandler<T extends CommandId>(commandId: T, handler: HandleEvent<CommandIdToData<T>>): () => void {
        this.internalLogMessage("PostMessageService.registerMessageHandler", `Registering message handler for command: ${commandId}`);
        const eventListeners = this.eventListeners[commandId].eventListeners;
        eventListeners.push(handler);

        return () => {
            this.unregisterMessageHandler(commandId, handler);
        };
    }

    /**
     * Unregisters a handler for a specific command.
     * @param commandId The command to unregister the handler for
     * @param handler The handler to unregister
     */
    public unregisterMessageHandler<T extends MessageCommand>(commandId: T["command"], handler: HandleEvent<T["data"]>) {
        this.internalLogMessage("PostMessageService.unregisterMessageHandler", `Unregistering message handler for command: ${commandId}`);
        const eventListeners = this.eventListeners[commandId].eventListeners;
        const index = eventListeners.indexOf(handler);
        if (index !== -1) {
            eventListeners.splice(index, 1);
        }
    }

    /**
     * Sends a message to the extension and waits for a response.
     * @param command The command to send to the extension.
     * @param expectResponseId The command id to expect as a response.
     * @param timeout The timeout in milliseconds to wait for a response. If the timeout is reached the promise will be rejected. Default is -1 which means no timeout.
     * @returns A promise that resolves when the response is received with the response data.
     * @template TCommandId The command id of the command to send. E.g. `"getSummary"`
     * @template TResponseId The command id of the response to expect. E.g. `"getSummaryResponse"`
     */
    public sendAndReceive<TCommandId extends CommandId, TResponseId extends CommandId>(
        command: GetCommandById<TCommandId>,
        expectResponseId: TResponseId,
        timeout: number = -1
    ): Promise<CommandIdToData<TResponseId>> {
        const message: PostMessageCommand<TCommandId> = {
            ...command,
            id: uuid(),
        };
        return new Promise<CommandIdToData<TResponseId>>((resolve, reject) => {
            const handleResponse = (response: unknown) => {
                const responseSchema = this.eventListeners[expectResponseId].commandSchema;
                const parsedResponse = responseSchema.safeParse(response);
                if (parsedResponse.success) {
                    resolve(parsedResponse.data);
                } else {
                    debugger;
                    this.internalLogErrorMessage(
                        "sendAndReceive.handleResponse",
                        `Received unexpected response to ${message.command} that could not be parsed according to expected schema. Expected response command id: ${expectResponseId}. - Received response data ${JSON.stringify(response)} - Parse error: ${parsedResponse.error.toString()}`
                    );
                    reject(new Error("Invalid response received", parsedResponse.error));
                }
            };

            this.postMessage(message);
            this.receivedMessages.set(message.id, handleResponse);

            if (timeout > 0) {
                setTimeout(() => {
                    if (this.receivedMessages.has(message.id)) {
                        this.receivedMessages.delete(message.id);
                        this.internalLogErrorMessage(
                            "PostMessageService.sendAndReceive",
                            `Timeout after ${timeout}ms waiting for response to command: '${command.command}'`
                        );
                        reject(new Error("Timeout"));
                    }
                }, timeout);
            }
        });
    }

    /**
     * Replies to a message with a given command and request id.
     * @param command The command to send
     * @param requestId The id of the message that should be replied to
     * @returns void
     */
    protected replyToMessage(command: MessageCommand, requestId: string) {
        this.sendAndForget(command, requestId);
    }

    /**
     * Acknowledges a message by sending a messageAck command to the webview.
     * @param id The id of the message to acknowledge
     */
    public acknowledgeMessage(id: string): void {
        this.internalLogErrorMessage("acknowledgeMessage", `Ack message ${id}`);
        this.sendAndForget({ command: "messageAck", data: undefined }, id);
    }

    /**
     * Sends a message to the extension and forgets about it. No response is expected.
     *
     * If you need to know if the message was received and processed by the extension, use {@link sendAndReceive} instead.
     * @param command The command to send to the extension
     * @param requestId The id of the message that the UI sent to the extension. If no id is provided, a new id will be generated.
     */
    public sendAndForget(command: MessageCommand, requestId: string | undefined = undefined): void {
        const message: PostMessageCommand<MessageCommand["command"]> = {
            ...command,
            id: requestId ?? uuid(),
        };
        this.postMessage(message);
    }

    /**
     * Logs a message to the extension. Called by internal methods of this class.
     *
     * Implement this command so that it either sends a log message to the extension or logs it directly in case of the extension.
     * @param event The event to log
     * @param message The message to log
     */
    protected abstract internalLogMessage(event: string, message: string): void;

    /**
     * Logs an error message to the extension. Called by internal methods of this class.
     *
     * Implement this command so that it either sends an error message to the extension or logs it directly in case of the extension.
     * @param event The event to log
     * @param errorMessage The error message to log
     */
    protected abstract internalLogErrorMessage(event: string, errorMessage: string): void;

    /**
     * Sends a message either to the extension or to the webview.
     *
     * For the extension this is implemented through the webview instance.
     * For the webview this is implemented through the vscode api.
     * @param message The post message to send.
     */
    protected abstract postMessage(message: unknown): void;
}







