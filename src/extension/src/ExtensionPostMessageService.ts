import { Webview, Disposable } from "vscode";
import { ITelemetryLogger } from "./telemetry/ITelemetryLogger";
import { ScopedILogger } from "./telemetry/ILogger";
import { MessageCommand, PostMessageCommand, PostMessageServiceBase } from "@t200logs/common";
import { v4 as uuid } from "uuid";

export class ExtensionPostMessageService extends PostMessageServiceBase implements Disposable {
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
     * The webview that the post message service is registered to.
     */
    private webview: Webview | null = null;

    /**
     * A list of disposables that are disposed when the post message service is disposed.
     */
    private disposables: Disposable[] = [];

    private readonly logMessageHandlers: (() => void)[] = [];

    /**
     *  Creates a new instance of the post message service.
     * @param logger The logger
     */
    constructor(logger: ITelemetryLogger) {
        super();
        this.logger = logger.createLoggerScope("ExtensionPostMessageService");
        this.webviewLogger = logger.createLoggerScope("Webview");
    }

    public dispose() {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }

        for (const unregisterLogMessageHandler of this.logMessageHandlers) {
            unregisterLogMessageHandler();
        }
    }

    protected startListening(): void {
        const webviewEventDisposable = this.webview?.onDidReceiveMessage(this.onMessageReceived, this);
        if (webviewEventDisposable) {
            this.disposables.push(webviewEventDisposable);

            this.registerLogMessageHandler();
        } else {
            this.logger.logException(
                "startListening",
                new Error("Failed to register event listener"),
                "Failed to register event listener. Webview is not defined.",
                {
                    webview: this.webview?.toString(),
                }
            );
        }
    }

    private registerLogMessageHandler() {
        const unregisterLogMessageHandler = this.registerMessageHandler("logMessage", message => {
            this.webviewLogger.info(message.event, message.message);
        });
        this.logMessageHandlers.push(unregisterLogMessageHandler);

        const unregisterErrorMessageHandler = this.registerMessageHandler("logErrorMessage", message => {
            this.webviewLogger.logException(message.event, new Error(message.errorMessage));
        });
        this.logMessageHandlers.push(unregisterErrorMessageHandler);
    }

    protected internalLogMessage(event: string, message: string): void {
        this.logger.info(event, message);
    }
    protected internalLogErrorMessage(event: string, errorMessage: string): void {
        this.logger.logException(event, new Error(errorMessage));
    }
    protected postMessage(message: unknown): void {
        if (!this.webview) {
            this.logger.logException(
                "sendMessage",
                new Error("Webview is not defined"),
                "Cannot send message because the webview is not defined",
                {
                    message: JSON.stringify(message),
                }
            );
            return;
        }
        this.webview.postMessage(message).then(result => {
            if (!result) {
                this.logger.logException(
                    "sendMessage.sendFailure",
                    new Error("Failed to send message to webview"),
                    "Failed to send message to webview",
                    {
                        message: JSON.stringify(message),
                    }
                );
            }
        });
    }

    /**
     * Registers the webview to the post message service so that it can send and receive messages.
     * @param webview The webview to register
     */
    public registerWebview(webview: Webview) {
        this.logger.info("registerWebview");
        this.webview = webview;
        this.startListening();
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
}

