/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { z } from "zod";

/**
 * Schema for the different types of log files.
 */
const LogFileTypeSchema = z.union([z.literal("web"), z.literal("desktop"), z.literal("har")]);

/**
 * The different types of log files.
 */
export type LogFileType = z.infer<typeof LogFileTypeSchema>;

/**
 * The schema for the file list.
 */
export const LogFileNameSchema = z.object({
    /**
     * The file name.
     */
    fileName: z.string(),

    /**
     * The type of file.
     */
    fileType: LogFileTypeSchema,

    /**
     * The number of entries for the file.
     */
    numberOfEntries: z.number().nonnegative(),

    /**
     * Number of entries after filtering.
     */
    numberOfFilteredEntries: z.number().nonnegative(),
});

/**
 * Extends the {@link LogFileNameSchema} with the state of the file.
 */
export const LogFileNameWithStateSchema = LogFileNameSchema.extend({
    /**
     * Whether the file is enabled and log entries are included in the view.
     */
    isEnabled: z.boolean(),
});

/**
 * A single file and its properties.
 */
export type LogFile = z.infer<typeof LogFileNameSchema>;

/**
 * A single file and its properties with the state of the file.
 */
export type LogFileWithState = z.infer<typeof LogFileNameWithStateSchema>;

/**
 * A list of {@link LogFile|files} and their properties used to display the file list.
 */
export type LogFileList = LogFile[];

/**
 * A list of {@link LogFileWithState|files} and their properties used to display the file list with state.
 */
export type LogFileListWithState = LogFileWithState[];
