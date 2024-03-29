/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { TelemetryEventMeasurements, TelemetryEventProperties } from "@vscode/extension-telemetry";

/**
 * Interface for a telemetry logger.
 */
export interface ILogger {
    /**
     * Starts logging.
     * @param shouldShowWelcomeMessage Whether to show the welcome message.
     */
    startLogging(shouldShowWelcomeMessage: boolean): void;

    /**
     * Logs the informational message.
     * @param eventName The identifiable location where the event was triggered from.
     * @param message The message.
     * @param properties The optional properties.
     * @param showDialog Whether to show the information dialog to the user.
     * @param infoTitle An info title to display in an information dialog.
     * @param measurements The optional measurements.
     */
    info(
        eventName: string,
        message?: string,
        properties?: TelemetryEventProperties,
        showDialog?: boolean,
        infoTitle?: string,
        measurements?: TelemetryEventMeasurements
    ): Promise<void>;

    /**
     * Logs the exception.
     * @param eventName The identifiable location where the exception was caught.
     * @param exception The exception.
     * @param exceptionMessage The exception message.
     * @param properties The optional properties.
     * @param showDialog Whether to show the error dialog to the user.
     * @param errorTitle An error title to display in an error dialog.
     */
    logException(
        eventName: string,
        exception: unknown,
        exceptionMessage?: string,
        properties?: TelemetryEventProperties,
        showDialog?: boolean,
        errorTitle?: string
    ): Promise<void>;
}

type ILoggerLoggingMethods = Pick<ILogger, "info" | "logException">;

type DropFirstParameter<T> = T extends (first: never, ...rest: infer U) => Promise<void> ? (method: string, ...args: U) => void : never;

/**
 * Scoped logger type to remove the first parameter from the logging methods.
 */
export type ScopedILogger = {
    [K in keyof ILoggerLoggingMethods]: DropFirstParameter<ILoggerLoggingMethods[K]>;
};
