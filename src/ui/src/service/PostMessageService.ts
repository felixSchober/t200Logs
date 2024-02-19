import {
    CommandId,
    MessageCommand,
    PostMessageCommand,
    PostMessageSchema,
    MessageSchemaMap,
    CommandIdToData,
    GetCommandById,
} from "@t200logs/common";
import { WebviewApi } from "vscode-webview";
import { v4 as uuid } from "uuid";
import { z } from "zod";

/**
 * A function that handles when a message with a specific command is received.
 * @param data The data received with the message
 * @template T The type of the data received with the message
 */
type HandleEvent<T> = (data: T) => void;

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

export class PostMessageService<TState = unknown> {
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

    constructor(private readonly vscodeApi: WebviewApi<TState>) {
        this.startListening();
    }

    private startListening() {
        console.log("Starting to listen for messages from extension.");
        window.addEventListener("message", event => {
            this.onMessageReceived(event);
        });
    }

    /**
     * Handles the message received from the extension.
     * @param event The message event received from the extension.
     */
    private onMessageReceived(event: MessageEvent<unknown>) {
        const messageData = event.data;
        const parsedData = PostMessageSchema.safeParse(messageData);

        if (!parsedData.success) {
            console.error("Invalid message received", parsedData.error);
            this.sendLogErrorMessage("PostMessageService.onMessageReceived", "Invalid message received from extension.");
            return;
        }

        const messageId = parsedData.data.id;
        this.sendLogMessage("PostMessageService.onMessageReceived", `Received message with id: ${messageId}`);

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

        for (const listener of eventListeners) {
            const listenerForData = listener as HandleEvent<typeof parsedMessageData>;
            listenerForData(parsedMessageData);
        }
    }

    /**
     * Parses the message data using the provided schema.
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
    public registerMessageHandler<T extends MessageCommand>(commandId: T["command"], handler: HandleEvent<T["data"]>) {
        this.sendLogMessage("PostMessageService.registerMessageHandler", `Registering message handler for command: ${commandId}`);
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
        this.sendLogMessage("PostMessageService.unregisterMessageHandler", `Unregistering message handler for command: ${commandId}`);
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
                    console.error(
                        "Received response that could not be parsed according to PostMessageSchema",
                        parsedResponse.error,
                        response
                    );
                    reject(new Error("Invalid response received", parsedResponse.error));
                }
            };

            this.vscodeApi.postMessage(message);
            this.receivedMessages.set(message.id, handleResponse);

            if (timeout > 0) {
                setTimeout(() => {
                    if (this.receivedMessages.has(message.id)) {
                        this.receivedMessages.delete(message.id);
                        this.sendLogErrorMessage(
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
     * Sends a message to the extension and forgets about it. No response is expected.
     *
     * If you need to know if the message was received and processed by the extension, use {@link sendAndReceive} instead.
     * @param command The command to send to the extension
     */
    public sendAndForget(command: MessageCommand) {
        const message: PostMessageCommand<MessageCommand["command"]> = {
            ...command,
            id: uuid(),
        };
        this.vscodeApi.postMessage(message);
    }

    /**
     * Sends a log message to the extension which will in turn log the message to the output window and log file.
     * @param logMessage The message to log
     */
    public sendLogMessage(event: string, logMessage: string) {
        console.log("[PostMessageService] Sending log message", logMessage);
        this.sendAndForget({
            command: "logMessage",
            data: {
                event,
                message: logMessage,
            },
        });
    }

    /**
     * Sends a log error message to the extension which will in turn log the message to the output window and log file.
     * @param errorMessage The error message to log
     */
    public sendLogErrorMessage(event: string, errorMessage: string) {
        console.error("[PostMessageService] Sending log error message", errorMessage);
        this.sendAndForget({
            command: "logErrorMessage",
            data: {
                event,
                errorMessage,
            },
        });
    }
}




