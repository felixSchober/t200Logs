/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import TelemetryReporter from "@vscode/extension-telemetry";

import { ILogger, ScopedILogger } from "./ILogger";

/**
 * Utility interface to extend both {@link ILogger} and {@link TelemetryReporter}.
 */
export interface ITelemetryLogger extends TelemetryReporter, ILogger {
    /**
     * Opens the log file in the window.
     */
    openLogFile(): Promise<void>;

    /**
     * Opens a teams chat window to provide feedback.
     */
    provideFeedback(): Promise<void>;

    /**
     *
     */
    createLoggerScope(className: string): ScopedILogger;
}

