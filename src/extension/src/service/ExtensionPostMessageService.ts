/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { PostMessageServiceBase } from "@t200logs/common";
import { Disposable, Webview } from "vscode";

import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";

/**
 * The post message service for the extension.
 */
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
     * A list of messages that are in the queue to be sent to the webview.
     * This is required because consumers of the service might send messages before the webview is registered.
     * This queue is processed when the webview is registered.
     */
    private readonly messagesInQueueToBeSent: unknown[] = [];

    /**
     * A list of disposables that are disposed when the post message service is disposed.
     */
    private disposables: Disposable[] = [];

    private readonly unregisterMessageHandlers: (() => void)[] = [];

    /**
     * Creates a new instance of the post message service.
     * @param logger The logger.
     */
    constructor(logger: ITelemetryLogger) {
        super();
        this.logger = logger.createLoggerScope("EX.PostMessageService");
        this.webviewLogger = logger.createLoggerScope("UI.PostMessageService");
    }

    /**
     * Disposes the post message service.
     */
    public dispose() {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }

        for (const unregisterMessageHandler of this.unregisterMessageHandlers) {
            unregisterMessageHandler();
        }
    }

    /**
     * Starts listening for messages from the webview.
     */
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

    /**
     * Registers listeners for log messages and error messages from the webview.
     */
    private registerLogMessageHandler() {
        const unregisterLogMessageHandler = this.registerMessageHandler("logMessage", message => {
            this.webviewLogger.info(`.LOG.${message.event}`, message.message);
        });
        this.unregisterMessageHandlers.push(unregisterLogMessageHandler);

        const unregisterErrorMessageHandler = this.registerMessageHandler("logErrorMessage", message => {
            this.webviewLogger.logException(`.LOG.${message.event}`, new Error(message.errorMessage));
        });
        this.unregisterMessageHandlers.push(unregisterErrorMessageHandler);
    }

    /**
     * Handles logging a message from the within the service.
     * @param event The event that was received.
     * @param message The message that was received.
     */
    protected internalLogMessage(event: string, message: string): void {
        this.logger.info(event, message);
    }
    /**
     * Handles logging an error message from the within the service.
     * @param event The event that was received.
     * @param errorMessage The error message that was received.
     */
    protected internalLogErrorMessage(event: string, errorMessage: string): void {
        this.logger.logException(event, new Error(errorMessage));
    }
    /**
     * Sends a message to the webview.
     * @param message The message to send.
     */
    protected postMessage(message: unknown): void {
        if (!this.webview) {
            this.logger.info("sendMessage", "Cannot send message because the webview is not defined. Adding to queue.", {
                message: JSON.stringify(message),
                messagesInQueue: "" + this.messagesInQueueToBeSent.length,
            });
            this.messagesInQueueToBeSent.push(message);
            return;
        }
        void this.webview.postMessage(message).then(result => {
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
     * @param webview The webview to register.
     */
    public registerWebview(webview: Webview) {
        this.logger.info("registerWebview");
        this.webview = webview;
        this.startListening();

        // register a listener for the webview ready message
        // once the webview is ready, we can start processing messages in the queue
        const unregisterWebviewReadyHandler = this.registerMessageHandler("webviewReady", (_, respond) => {
            this.logger.info("registerWebview.webviewReady.messageReceived");
            respond({ command: "messageAck", data: undefined });
            this.processMessagesInQueue();
        });
        this.unregisterMessageHandlers.push(unregisterWebviewReadyHandler);
    }

    /**
     * Processes the messages in the queue to be sent to the webview.
     */
    private processMessagesInQueue() {
        // even though we are only processing the messages in the queue when the webview is ready,
        // there is a slight delay when React is rerendering the webview and the webview is ready.
        // therefore, we have to use a small delay to ensure that the webview is ready to receive messages.
        setTimeout(() => {
            this.logger.info("registerWebview.queue", "Processing messages in queue", {
                messagesInQueue: "" + this.messagesInQueueToBeSent.length,
            });
            // Process any messages that were sent before the webview was registered
            while (this.messagesInQueueToBeSent.length > 0) {
                const message = this.messagesInQueueToBeSent.shift();
                this.logger.info("registerWebview.queue", "Processing message from queue", {
                    messageData: JSON.stringify(message),
                });
                if (message) {
                    this.postMessage(message);
                }
            }
        }, 200);
    }
}

