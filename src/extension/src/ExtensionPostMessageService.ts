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

    private readonly summaryInfoProvider: SummaryInfoProvider;
    private webview: Webview | null = null;

    private webviewEventDisposable: Disposable | null = null;

    constructor(
        private readonly onWebviewFilterChanged: EventEmitter<FilterChangedEvent>,
        private readonly onWebviewDisplaySettingsChanged: EventEmitter<DisplaySettingsChangedEvent>,
        private readonly getNumberOfActiveFilters: () => number,
        private readonly timeChangeEvent: VscodeEvent<TimeFilterChangedEvent>,
        private readonly keywordChangeEventEmitter: EventEmitter<KeywordHighlightChangeEvent>,
        logger: ITelemetryLogger
    ) {
        this.logger = logger.createLoggerScope("ExtensionPostMessageService");
        this.webviewLogger = logger.createLoggerScope("Webview");
        this.summaryInfoProvider = new SummaryInfoProvider(logger);
    }
    dispose() {
        if (this.webviewEventDisposable) {
            this.webviewEventDisposable.dispose();
        }
    }

    public registerWebview(webview: Webview) {
        this.logger.info("registerWebview");
        this.webview = webview;
        this.webviewEventDisposable = this.webview.onDidReceiveMessage(this.handleMessageReceived, this);
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

            // case "keywordHighlightCheckboxStateChange":
            //     let keywordChangeEvent: KeywordHighlightChangeEvent;
            //     const highlightDefinition = message.highlightDefinition as KeywordHighlight;

            //     if (message.isChecked) {
            //         keywordChangeEvent = {
            //             addKeyword: highlightDefinition,
            //         };
            //     } else {
            //         keywordChangeEvent = {
            //             removeKeyword: highlightDefinition.keyword,
            //         };
            //     }
            //     this.keywordChangeEventEmitter.fire(keywordChangeEvent);
            //     break;
            // case "filterCheckboxStateChange":
            //     const filterDefinition = message.filterDefinition as FilterKeywordChangedEvent;

            //     if (filterDefinition.isChecked) {
            //         this.onWebviewFilterChanged.fire({
            //             addKeywordFilter: filterDefinition.keyword,
            //         });
            //     } else {
            //         this.onWebviewFilterChanged.fire({
            //             removeKeywordFilter: filterDefinition.keyword,
            //         });
            //     }
            //     break;

            // case "filterLogLevel":
            //     let event: FilterChangedEvent;
            //     if (message.isChecked) {
            //         event = {
            //             addLogLevel: message.logLevel,
            //         };
            //     } else {
            //         event = {
            //             removeLogLevel: message.logLevel,
            //         };
            //     }
            //     this.onWebviewFilterChanged.fire(event);
            //     break;

            // case "timeFilterInputFromChange":
            //     this.onWebviewFilterChanged.fire({
            //         fromDate: message.timeFilter,
            //     });
            //     break;

            // case "timeFilterInputTillChange":
            //     this.onWebviewFilterChanged.fire({
            //         tillDate: message.timeFilter,
            //     });
            //     break;
            // case "filterNoEventTimeCheckboxStateChange":
            //     this.onWebviewFilterChanged.fire({
            //         removeEntriesWithNoEventTime: message.isChecked,
            //     });
            //     break;
            // case "filterSessionIdCheckboxStateChange":
            //     let changeEvent: FilterChangedEvent;
            //     if (message.isChecked) {
            //         changeEvent = {
            //             setSessionIdFilter: message.sessionId,
            //         };
            //     } else {
            //         changeEvent = {
            //             removeSessionIdFilter: message.sessionId,
            //         };
            //     }
            //     this.onWebviewFilterChanged.fire(changeEvent);
            //     break;
            // case "displayFilenamesCheckboxStateChange":
            //     this.onWebviewDisplaySettingsChanged.fire({
            //         displayFileNames: message.isChecked,
            //         displayGuids: null,
            //         displayDatesInLine: null,
            //     });
            //     break;
            // case "displayGuidsCheckboxStateChange":
            //     this.onWebviewDisplaySettingsChanged.fire({
            //         displayFileNames: null,
            //         displayGuids: message.isChecked,
            //         displayDatesInLine: null,
            //     });
            //     break;
            // case "displayTimeInlineCheckboxStateChange":
            //     this.onWebviewDisplaySettingsChanged.fire({
            //         displayFileNames: null,
            //         displayGuids: null,
            //         displayDatesInLine: message.isChecked,
            //     });
            //     break;
            // case "displayVisualHintsCheckboxStateChange":
            //     void VscodeCommands.executeCommand("t200logs.toggleVisualHints");
            //     break;
            // case "displayReadableIsoDatesCheckboxStateChange":
            //     void VscodeCommands.executeCommand("t200logs.toggleReadableIsoDates");
            //     break;
            // case "openLogsDocument":
            //     void this.openLogsDocument();
            //     break;
            // case "getSummaryInfo":
            //     void this.summaryInfoProvider.getSummaryInfo().then(summaryInfo => {
            //         void webviewView.webview.postMessage({
            //             command: "summaryInfo",
            //             summaryInfo,
            //         });
            //     });
            //     break;
            // default:
            //     this.logger.info("webviewView.onDidReceiveMessage.unknownCommand", "Unknown command", { command: message.command });
            //     break;
        }

        // if command was a filter command - send message back with currently active filters
        // if (message.command.startsWith("filter")) {
        //     const numberOfActiveFilters = this.getNumberOfActiveFilters();
        //     this.logger.info("webviewView.onDidReceiveMessage.filterNumberUpdate", "Sending number of active filters", {
        //         numberOfActiveFilters: "" + numberOfActiveFilters,
        //     });
        //     void webviewView.webview.postMessage({
        //         command: "updateNumberOfActiveFilters",
        //         numberOfActiveFilters,
        //     });
        // }
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
     * Handles the getSummary command by sending the summary info to the webview.
     * @param message The message to handle
     */
    private async handleGetSummary(messageId: string) {
        const summary = await this.summaryInfoProvider.getSummaryInfo();
        this.replyToMessage({ command: "getSummaryResponse", data: { summary } }, messageId);
    }

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

        // respond with the number of active filters
        const numberOfActiveFilters = this.getNumberOfActiveFilters();
        this.replyToMessage({ command: "updateNumberOfActiveFilters", data: { numberOfActiveFilters } }, message.id);

        // case "filterCheckboxStateChange":
        //     const filterDefinition = message.filterDefinition as FilterKeywordChangedEvent;

        //     if (filterDefinition.isChecked) {
        //         this.onWebviewFilterChanged.fire({
        //             addKeywordFilter: filterDefinition.keyword,
        //         });
        //     } else {
        //         this.onWebviewFilterChanged.fire({
        //             removeKeywordFilter: filterDefinition.keyword,
        //         });
        //     }
        //     break;
    }

    /**
     *
     * @param command The command to send
     * @param requestId The id of the message that the UI sent to the extension.
     * @returns void
     */
    private async replyToMessage(command: MessageCommand, requestId: string) {
        const message: PostMessageCommand<MessageCommand["command"]> = {
            ...command,
            id: requestId,
        };

        if (!this.webview) {
            this.logger.logException(
                "replyToMessage",
                new Error("Webview is not defined"),
                "Cannot reply to message because the webview is not defined",
                {
                    commandId: command.command,
                    requestId,
                }
            );
            return;
        }
        const result = this.webview.postMessage(message);
        if (!result) {
            this.logger.logException(
                "replyToMessage",
                new Error("Failed to send message to webview"),
                "Failed to send message to webview",
                {
                    commandId: command.command,
                    requestId,
                }
            );
        }
    }
}

