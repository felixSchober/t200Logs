import { EventEmitter, Webview, Event as VscodeEvent, Disposable } from "vscode";
import { ITelemetryLogger } from "./telemetry/ITelemetryLogger";
import { ScopedILogger } from "./telemetry/ILogger";
import {
    CommandId,
    CommandIdToData,
    DisplaySettingsChangedEvent,
    FilterChangedEvent,
    KeywordHighlightChangeEvent,
    MessageCommand,
    MessageSchemaMap,
    PostMessageCommand,
    PostMessageSchema,
    PostMessageWithUnknownData,
    TimeFilterChangedEvent,
} from "@t200logs/common";
import { SummaryInfoProvider } from "./info/SummaryInfoProvider";
import { v4 as uuid } from "uuid";

export class ExtensionPostMessageService implements Disposable {
    /**
     * The logger for the class.
     */
    private readonly logger: ScopedILogger;

    /**
     * The logger for the webview.
     * Used to log messages sent from the webview to the extension.
     */
    private readonly webviewLogger: ScopedILogger;

    /**
     * The provider for the summary info.
     */
    private readonly summaryInfoProvider: SummaryInfoProvider;

    /**
     * The webview that the post message service is registered to.
     */
    private webview: Webview | null = null;

    /**
     * A list of disposables that are disposed when the post message service is disposed.
     */
    private disposables: Disposable[] = [];

    /**
     *  Creates a new instance of the post message service.
     *
     * @param onWebviewFilterChanged The event emitter for when the user changes a filter through the webview.
     * @param onWebviewDisplaySettingsChanged The event emitter for when the user changes display settings change.
     * @param getNumberOfActiveFilters A function that returns the number of active filters.
     * @param timeChangeEvent The event for when the time filter changes through the LogContentProvider.
     * @param openLogsDocument A function that opens the logs document.
     * @param keywordChangeEventEmitter The event emitter for when the user changes a keyword highlight through the webview.
     * @param logger The logger
     */
    constructor(
        private readonly onWebviewFilterChanged: EventEmitter<FilterChangedEvent>,
        private readonly onWebviewDisplaySettingsChanged: EventEmitter<DisplaySettingsChangedEvent>,
        private readonly getNumberOfActiveFilters: () => number,
        private readonly timeChangeEvent: VscodeEvent<TimeFilterChangedEvent>,
        private readonly openLogsDocument: () => Promise<void>,
        private readonly keywordChangeEventEmitter: EventEmitter<KeywordHighlightChangeEvent>,
        logger: ITelemetryLogger
    ) {
        this.logger = logger.createLoggerScope("ExtensionPostMessageService");
        this.webviewLogger = logger.createLoggerScope("Webview");
        this.summaryInfoProvider = new SummaryInfoProvider(logger);
    }

    public dispose() {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }

    public registerWebview(webview: Webview) {
        this.logger.info("registerWebview");
        this.webview = webview;
        const webviewEventDisposable = this.webview.onDidReceiveMessage(this.handleMessageReceived, this);
        this.disposables.push(webviewEventDisposable);

        const timeChangeDisposable = this.timeChangeEvent(this.handleTimeFilterChanged, this);
        this.disposables.push(timeChangeDisposable);
    }

    private handleMessageReceived(message: unknown) {
        // try parsing the message
        const parseResult = PostMessageSchema.safeParse(message);
        if (!parseResult.success) {
            this.logger.logException(
                "handleMessageReceived",
                new Error("Invalid message received"),
                "Message received that could not be parsed",
                {
                    error: parseResult.error.toString(),
                }
            );
            return;
        }
        const parsedMessage = parseResult.data;

        this.logger.info("handleMessageReceived", undefined, { command: parsedMessage.command });

        switch (parsedMessage.command) {
            case "getSummary":
                this.handleGetSummary(parsedMessage.id);
                break;

            case "logMessage":
            case "logErrorMessage":
                this.handleLogMessages(parsedMessage);
                break;

            case "filterCheckboxStateChange":
                this.handleFilterCheckboxStateChange(parsedMessage);
                break;

            case "filterLogLevel":
                this.handleFilterLogLevel(parsedMessage);
                break;

            case "filterTime":
                this.handleFilterTime(parsedMessage);
                break;

            case "filterSessionId":
                this.handleFilterSessionId(parsedMessage);
                break;

            case "filterNoEventTime":
                this.handleFilterNoEventTime(parsedMessage);
                break;

            case "displaySettingsChanged":
                this.handleDisplaySettingsChanged(parsedMessage);
                break;

            case "keywordHighlightStateChange":
                this.handleKeywordHighlightStateChange(parsedMessage);
                break;

            case "openLogsDocument":
                this.openLogsDocument();
                break;
            default:
                this.logger.info("handleMessageReceived.unknownCommand", "Unknown command", {
                    command: parsedMessage.command,
                    id: parsedMessage.id,
                });
                break;
        }
    }

    /**
     * Parses the data for a message command.
     * @param commandId The command id
     * @param data The data to parse
     * @returns The parsed data or null if the data could not be parsed
     */
    private safeParseMessageData<T extends CommandId>(commandId: T, data: unknown): CommandIdToData<T> | null {
        const schema = MessageSchemaMap[commandId];
        const parseResult = schema.safeParse(data);
        if (!parseResult.success) {
            this.logger.logException("safeParseMessageData", new Error("Failed to parse message data"), "Failed to parse message data", {
                commandId,
                error: parseResult.error.toString(),
            });
            return null;
        }
        return parseResult.data;
    }

    /**
     * Is executed when the time filter changes by the LogContentProvider.
     * @param event The time filter changed event
     */
    private handleTimeFilterChanged(event: TimeFilterChangedEvent) {
        this.logger.info("handleTimeFilterChanged", "Time filter changed", { from: event.fromDate, till: event.tillDate });
        this.sendMessage({ command: "updateTimeFilters", data: event });
    }

    /**
     * Handles the getSummary command by sending the summary info to the webview.
     * @param message The message to handle
     */
    private async handleGetSummary(messageId: string) {
        const summary = await this.summaryInfoProvider.getSummaryInfo();
        this.replyToMessage({ command: "getSummaryResponse", data: { summary } }, messageId);
    }

    /**
     * Is executed when the webview wants to log a message or error
     * @param message The message to handle
     */
    private handleLogMessages(message: PostMessageWithUnknownData) {
        if (message.command === "logMessage") {
            const parsedPayload = this.safeParseMessageData("logMessage", message.data);
            if (parsedPayload) {
                this.webviewLogger.info(parsedPayload.event, parsedPayload.message);
            }
        } else if (message.command === "logErrorMessage") {
            const parsedPayload = this.safeParseMessageData("logErrorMessage", message.data);
            if (parsedPayload) {
                this.webviewLogger.logException(parsedPayload.event, new Error(parsedPayload.errorMessage));
            }
        }
    }

    /**
     * Is executed when the webview changes the state of a filter checkbox
     * @param message The message to handle
     * @returns void
     */
    private handleFilterCheckboxStateChange(message: PostMessageWithUnknownData) {
        const parsedPayload = this.safeParseMessageData("filterCheckboxStateChange", message.data);
        if (!parsedPayload) {
            return;
        }

        if (parsedPayload.isChecked) {
            this.onWebviewFilterChanged.fire({
                addKeywordFilter: parsedPayload.value,
            });
        } else {
            this.onWebviewFilterChanged.fire({
                removeKeywordFilter: parsedPayload.value,
            });
        }

        this.respondToFilterCommand(message.id);
    }

    /**
     * Responds to a filter command by sending the number of active filters to the webview.
     * @param messageId The id of the message that is used to identify responses.
     */
    private respondToFilterCommand(messageId: string) {
        // respond with the number of active filters
        const numberOfActiveFilters = this.getNumberOfActiveFilters();
        this.replyToMessage({ command: "updateNumberOfActiveFilters", data: { numberOfActiveFilters } }, messageId);
    }

    /**
     * Is executed when the webview wants to filter the log level
     * @param message The message to handle
     * @returns void
     */
    private handleFilterLogLevel(message: PostMessageWithUnknownData) {
        const parsedPayload = this.safeParseMessageData("filterLogLevel", message.data);
        if (!parsedPayload) {
            return;
        }

        if (parsedPayload.isChecked) {
            this.onWebviewFilterChanged.fire({
                addLogLevel: parsedPayload.logLevel,
            });
        } else {
            this.onWebviewFilterChanged.fire({
                removeLogLevel: parsedPayload.logLevel,
            });
        }

        this.respondToFilterCommand(message.id);
    }

    /**
     * Is executed when the webview wants to filter the time
     * @param message The message to handle
     * @returns void
     */
    private handleFilterTime(message: PostMessageWithUnknownData) {
        const parsedPayload = this.safeParseMessageData("filterTime", message.data);
        if (!parsedPayload) {
            return;
        }

        if (parsedPayload.fromDate) {
            this.onWebviewFilterChanged.fire({
                fromDate: parsedPayload.fromDate,
            });
        }

        if (parsedPayload.tillDate) {
            this.onWebviewFilterChanged.fire({
                tillDate: parsedPayload.tillDate,
            });
        }

        this.respondToFilterCommand(message.id);
    }

    /**
     * Is executed when the webview wants to filter the session id
     * @param message The message to handle
     * @returns void
     */
    private handleFilterSessionId(message: PostMessageWithUnknownData) {
        const parsedPayload = this.safeParseMessageData("filterSessionId", message.data);
        if (!parsedPayload) {
            return;
        }

        if (parsedPayload.isChecked) {
            this.onWebviewFilterChanged.fire({
                setSessionIdFilter: parsedPayload.sessionId,
            });
        } else {
            this.onWebviewFilterChanged.fire({
                removeSessionIdFilter: " ", // just needs to be NOT falsy
            });
        }

        this.respondToFilterCommand(message.id);
    }

    /**
     * Is executed when the webview wants to turn off/on hiding events without a time
     * @param message The message to handle
     * @returns void
     */
    private handleFilterNoEventTime(message: PostMessageWithUnknownData) {
        const parsedPayload = this.safeParseMessageData("filterNoEventTime", message.data);
        if (!parsedPayload) {
            return;
        }

        this.onWebviewFilterChanged.fire({
            removeEntriesWithNoEventTime: parsedPayload.removeEntriesWithNoEventTime,
        });

        this.respondToFilterCommand(message.id);
    }

    /**
     * Is executed when the webview changes how the logs are displayed
     * @param message The message to handle
     * @returns void
     */
    private handleDisplaySettingsChanged(message: PostMessageWithUnknownData) {
        const parsedPayload = this.safeParseMessageData("displaySettingsChanged", message.data);
        if (!parsedPayload) {
            return;
        }

        this.onWebviewDisplaySettingsChanged.fire(parsedPayload);
    }

    /**
     * Is executed when the webview wants to change the keyword highlight state
     * @param message The message to handle
     * @returns void
     */
    private handleKeywordHighlightStateChange(message: PostMessageWithUnknownData) {
        const parsedPayload = this.safeParseMessageData("keywordHighlightStateChange", message.data);
        if (!parsedPayload) {
            return;
        }

        if (parsedPayload.isChecked) {
            this.keywordChangeEventEmitter.fire({
                addKeyword: parsedPayload.keywordDefinition,
            });
        } else {
            this.keywordChangeEventEmitter.fire({
                removeKeyword: parsedPayload.keywordDefinition.keyword,
            });
        }
    }

    /**
     *
     * @param command The command to send
     * @param id The id of the message that is used to identify responses. If not provided, a new id will be generated.
     * @returns
     */
    public async sendMessage(command: MessageCommand, id?: string) {
        if (!this.webview) {
            this.logger.logException(
                "sendMessage",
                new Error("Webview is not defined"),
                "Cannot send message because the webview is not defined",
                {
                    commandId: command.command,
                    id: id ?? "undefined",
                }
            );
            return;
        }
        const message: PostMessageCommand<MessageCommand["command"]> = {
            ...command,
            id: id ?? uuid(),
        };
        this.logger.info("sendMessage", undefined, {
            commandId: command.command,
            id: id ?? "undefined",
            payload: JSON.stringify(command.data),
        });
        const result = this.webview.postMessage(message);
        if (!result) {
            this.logger.logException("sendMessage", new Error("Failed to send message to webview"), "Failed to send message to webview", {
                commandId: command.command,
                id: id ?? "undefined",
            });
        }
    }

    /**
     *
     * @param command The command to send
     * @param requestId The id of the message that the UI sent to the extension.
     * @returns void
     */
    private async replyToMessage(command: MessageCommand, requestId: string) {
        await this.sendMessage(command, requestId);
    }
}









