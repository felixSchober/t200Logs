import { PostMessageServiceBase } from "@t200logs/common";
import { WebviewApi } from "vscode-webview";

/**
 * Implementation of a {@link PostMessageServiceBase|PostMessageService} that uses the vscode API to send and receive messages.
 */
export class PostMessageService<TState = unknown> extends PostMessageServiceBase {
    constructor(private readonly vscodeApi: WebviewApi<TState>) {
        super();
        this.startListening();
    }

    protected startListening() {
        console.log("Starting to listen for messages from extension.");
        window.addEventListener("message", event => {
            this.onMessageReceived(event);
        });
    }

    /**
     * Sends a log message to the extension which will in turn log the message to the output window and log file.
     * @param logMessage The message to log
     */
    protected override internalLogMessage(event: string, message: string): void {
        this.sendAndForget({
            command: "logMessage",
            data: {
                event,
                message,
            },
        });
    }

    /**
     * Sends a log error message to the extension which will in turn log the message to the output window and log file.
     * @param errorMessage The error message to log
     */
    protected override internalLogErrorMessage(event: string, errorMessage: string): void {
        this.sendAndForget({
            command: "logErrorMessage",
            data: {
                event,
                errorMessage,
            },
        });
    }

    public sendLogMessage(event: string, message: string): void {
        this.internalLogMessage(event, message);
    }

    public sendLogErrorMessage(event: string, errorMessage: string): void {
        this.internalLogErrorMessage(event, errorMessage);
    }

    /**
     * Sends a message to the extension and forgets about it. No response is expected.
     *
     * If you need to know if the message was received and processed by the extension, use {@link sendAndReceive} instead.
     * @param command The command to send to the extension
     */
    protected override postMessage(message: unknown): void {
        this.vscodeApi.postMessage(message);
    }
}

