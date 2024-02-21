/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import TelemetryReporter, { TelemetryEventMeasurements, TelemetryEventProperties } from "@vscode/extension-telemetry";
import * as vscode from "vscode";

import { DialogReporter } from "./DialogReporter";
import { FileSystemWriter } from "./FileSystemWriter";
import { ScopedILogger } from "./ILogger";
import { ITelemetryLogger } from "./ITelemetryLogger";

/**
 * Debug Telemetry Reporter that logs to console.
 */
export class DevLogger extends TelemetryReporter implements ITelemetryLogger {
    private readonly outputChannel: vscode.OutputChannel;

    private logFileWriter: FileSystemWriter | undefined;

    /**
     * Creates a new DevLogger instance.
     * @param logUri The URI of a folder to use to log telemetry events.
     */
    constructor(private readonly logUri: vscode.Uri) {
        super("key");
        this.outputChannel = vscode.window.createOutputChannel("T200 Logs Viewer Telemetry");
        this.sendTelemetryEvent("DevLogger.constructor", { logUri: this.logUri.path });
    }

    /**
     * Opens the log file in the window.
     */
    public async openLogFile(): Promise<void> {
        if (!this.logFileWriter || !this.logFileWriter.isReady) {
            await this.info(
                "DevLogger.openLogFile.notReady",
                "The log file hasn't been created yet. Either open the side panel for the extension or run the 'T200 Open Log Viewer' command.",
                undefined,
                true
            );
            return;
        }

        await vscode.window.showTextDocument(this.logFileWriter.logFileUri);
    }

    /**
     * Opens a teams chat window to provide feedback.
     */
    public async provideFeedback(): Promise<void> {
        await vscode.env.openExternal(
            vscode.Uri.parse("msteams:/l/chat/0/0?users=feschobe@microsoft.com&message=" + this.logFileWriter?.fileHeader)
        );
    }

    /**
     * Start logging to the log file if not already running.
     */
    public startLogging(): void {
        if (!this.logFileWriter) {
            this.logFileWriter = new FileSystemWriter(this, this.logUri);

            void this.displayLogFileMessage();
        }
    }

    /**
     * Displays the log file message.
     */
    private async displayLogFileMessage(): Promise<void> {
        const options = ["Quick Feedback", "Open Log File", "Close"];
        const option = await DialogReporter.showOptionsDialog(
            "Welcome! If you encounter any issues, use the command '> Provide Feedback' to send a message or open the log file with '> Open Log File'.",
            options
        );

        if (option === options[0]) {
            await this.provideFeedback();
        } else if (option === options[1]) {
            await this.openLogFile();
        }
    }

    /**
     * Logs the informational message.
     * @param eventName The identifiable location where the error was encountered.
     * @param message The message.
     * @param properties The optional properties.
     * @param showDialog Whether to show the information dialog to the user.
     * @param infoTitle An info title to display in an information dialog.
     * @param measurements The optional measurements.
     */
    public async info(
        eventName: string,
        message?: string,
        properties?: TelemetryEventProperties,
        showDialog?: boolean,
        infoTitle?: string,
        measurements?: TelemetryEventMeasurements
    ): Promise<void> {
        properties = message ? { ...properties, message } : properties;
        this.sendTelemetryEvent(eventName, properties, measurements);
        this.logFileWriter?.appendLine(this.getEventString(eventName, properties, measurements));

        if (showDialog) {
            await DialogReporter.showInformationDialog(infoTitle, message);
        }
    }

    /**
     * Logs the exception.
     * @param eventName The identifiable location where the exception was caught.
     * @param exception The exception.
     * @param exceptionMessage The exception message.
     * @param properties The optional properties.
     * @param showDialog Whether to show the error dialog to the user.
     * @param errorTitle An error title to display in an error dialog.
     */
    public async logException(
        eventName: string,
        exception: unknown,
        exceptionMessage?: string | undefined,
        properties?: TelemetryEventProperties | undefined,
        showDialog?: boolean,
        errorTitle?: string
    ): Promise<void> {
        let errorMessage: string = exceptionMessage + " Details: " ?? "";
        let errorProps: string[] = [];

        if (exception instanceof Error) {
            errorMessage += exception.message;
            errorProps = [exception.name, exception.stack ?? "no-stack"];
        } else {
            errorMessage += "" + JSON.stringify(exception);
        }
        this.sendTelemetryErrorEvent(eventName, properties, undefined, errorProps);
        this.logFileWriter?.appendLine(this.getErrorEventString(eventName, properties, undefined, errorProps));

        if (showDialog) {
            await DialogReporter.showErrorDialog(errorTitle, errorMessage);
        }
    }

    /**
     * Sends a telemetry event with the given properties and measurements.
     * @param eventName The name of the event.
     * @param properties The set of properties to add to the event in the form of a string key value pair.
     * @param measurements The set of measurements to add to the event in the form of a string key  number value pair.
     */
    public sendTelemetryEvent(eventName: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements): void {
        // eslint-disable-next-line no-console
        const telemetryLine = this.getEventString(eventName, properties, measurements);
        console.log(telemetryLine);
        this.outputChannel.appendLine(telemetryLine);
    }

    /**
     * Sends a telemetry error event with the given properties, measurements, and errorProps.
     * @param eventName The name of the event.
     * @param properties The set of properties to add to the event in the form of a string key value pair.
     * @param measurements The set of measurements to add to the event in the form of a string key  number value pair.
     * @param errorProps A list of case sensitive properties to drop, if excluded we drop all properties but still send the event.
     */
    public sendTelemetryErrorEvent(
        eventName: string,
        properties?: TelemetryEventProperties,
        measurements?: TelemetryEventMeasurements,
        errorProps?: string[]
    ): void {
        const telemetryLine = this.getErrorEventString(eventName, properties, measurements, errorProps);
        console.error(telemetryLine);
        this.outputChannel.appendLine(telemetryLine);
        // this.outputChannel.show();
    }

    /**
     * Creates a scoped logger that contains the same logging methods as {@link ILogger} but without having to pass the class name each time.
     * Furthermore, these methods will be fire and forget.
     * @param className The name of the class.
     * @returns The scoped logger that contains the same logging methods as {@link ILogger} but without having to pass the class name each time.
     */
    public createLoggerScope(className: string): ScopedILogger {
        return {
            info: (
                method: string,
                message?: string,
                properties?: TelemetryEventProperties,
                showDialog?: boolean,
                infoTitle?: string,
                measurements?: TelemetryEventMeasurements
            ) => {
                void this.info(`${className}.${method}`, message, properties, showDialog, infoTitle, measurements);
            },
            logException: (
                method: string,
                exception: unknown,
                exceptionMessage?: string,
                properties?: TelemetryEventProperties,
                showDialog?: boolean,
                errorTitle?: string
            ) => {
                void this.logException(`${className}.${method}`, exception, exceptionMessage, properties, showDialog, errorTitle);
            },
        };
    }

    /**
     * Constructs the telemetry event info string.
     * @param eventName The name of the event.
     * @param properties The set of properties to add to the event in the form of a string key value pair.
     * @param measurements The set of measurements to add to the event in the form of a string key  number value pair.
     * @returns The constructed telemetry event info string.
     */
    private getEventString(eventName: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements): string {
        return `> [${eventName}] ${properties ? JSON.stringify(properties) : ""} ${measurements ? JSON.stringify(measurements) : ""}`;
    }

    /**
     * Constructs the telemetry error event info string.
     * @param eventName The name of the event.
     * @param properties The set of properties to add to the event in the form of a string key value pair.
     * @param measurements The set of measurements to add to the event in the form of a string key  number value pair.
     * @param errorProps A list of error properties.
     * @returns The constructed telemetry error event info string.
     */
    private getErrorEventString(
        eventName: string,
        properties?: TelemetryEventProperties,
        measurements?: TelemetryEventMeasurements,
        errorProps: string[] = []
    ): string {
        return `> ERROR [${eventName}] ${properties ? JSON.stringify(properties) : ""} ${
            measurements ? JSON.stringify(measurements) : ""
        }\nError props: ${errorProps ? errorProps.join(", ") : ""}\n`;
    }

    /**
     * Disposes the telemetry reporter.
     * @returns Void promise.
     */
    dispose(): Promise<void> {
        this.outputChannel.dispose();
        this.logFileWriter?.dispose();
        return Promise.resolve();
    }
}







