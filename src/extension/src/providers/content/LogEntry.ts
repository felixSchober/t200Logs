/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { LogLevel } from "@t200logs/common";

/**
 * Represents a log entry.
 * This can be a
 * - Desktop log entry
 * - Web log entry
 * - HAR web request.
 */
export type LogEntry = {
    /**
     * The date of the log entry.
     */
    date: Date;

    /**
     * The text of the log entry.
     */
    text: string;

    /**
     * The service that generated the log entry. (This is a reduced file name).
     */
    service?: string;

    /**
     * The file path of the log entry if it exists.
     */
    filePath?: string;

    /**
     * Whether the log entry is a marker entry for grouping.
     */
    isMarker?: boolean;

    /**
     * The type of the log entry.
     */
    logLevel?: LogLevel;
};
