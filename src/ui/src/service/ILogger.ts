/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/**
 * Interface for a logger.
 */
export interface ILogger {
    /**
     * Logs a message to the through the post message service.
     * @param event The event that is being logged.
     * @param message The message to log.
     */
    log(event: string, message: string): void;

    /**
     * Logs an error message to the through the post message service.
     * @param event The event that is being logged.
     * @param message The message to log.
     */
    error(event: string, message: string): void;
}
