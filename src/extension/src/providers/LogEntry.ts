/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

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
     * The service that generated the log entry.
     */
    service?: string;

    /**
     * Whether the log entry is a marker entry for grouping.
     */
    isMarker?: boolean;
};

