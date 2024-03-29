/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { z } from "zod";

import { LogLevelSchema } from "../Events";
import { SummaryInfoSchema } from "../model";
import { KeywordHighlightSchema } from "../model/Keywords";
import { LogFileNameSchema, LogFileNameWithStateSchema } from "../model/LogFileList";

const ConfigurationUpdateSchema = z.union([z.literal("add"), z.literal("remove"), z.literal("update")]);

/**
 * Maps a command id to a schema for the data that is sent with the command.
 */
export const MessageSchemaMap = {
    logMessage: z.object({
        /**
         * Name of the event to log.
         */
        event: z.string(),

        /**
         * The message to log.
         */
        message: z.string(),
    }),
    logErrorMessage: z.object({
        /**
         * Name of the error to log.
         */
        event: z.string(),

        /**
         * The error to log.
         */
        errorMessage: z.string(),
    }),
    filterCheckboxStateChange: z.object({
        /**
         * The id of the filter checkbox.
         */
        id: z.string(),

        /**
         * The value of the filter checkbox.
         */
        value: z.string(),

        /**
         * The state of the filter checkbox.
         */
        isChecked: z.boolean(),
    }),
    updateFilterCheckboxState: z.object({
        /**
         * The id of the filter checkbox.
         */
        id: z.string(),

        /**
         * The value of the filter checkbox.
         */
        value: z.string(),

        /**
         * The state of the filter checkbox.
         */
        isChecked: z.boolean(),

        /**
         * The type of update to perform.
         */
        updateType: ConfigurationUpdateSchema,
    }),
    filterLogLevel: z.object({
        /**
         * The log level to filter.
         */
        logLevel: LogLevelSchema,

        /**
         * The state of the log level filter.
         */
        isChecked: z.boolean(),
    }),
    /**
     * Message sent from the extension to the webview to set the log levels from the configuration with disabled (unchecked) state.
     * E.g. ["info", "warning"] means that debug and error are enabled (checked) and info and warning are disabled (unchecked).
     */
    setLogLevelFromConfiguration: z.array(LogLevelSchema),
    filterTime: z.object({
        /**
         * The time filter.
         */
        fromDate: z.string().nullable().optional(),

        /**
         * The time filter.
         */
        tillDate: z.string().nullable().optional(),
    }),
    filterSessionId: z.object({
        /**
         * The session id to filter.
         */
        sessionId: z.string(),

        /**
         * The state of the session id filter.
         */
        isChecked: z.boolean(),
    }),
    filterNoEventTime: z.object({
        /**
         * When true, removes all entries that do not have an event time.
         */
        removeEntriesWithNoEventTime: z.boolean(),
    }),
    updateNumberOfActiveFilters: z.number().nonnegative(),
    updateNumberOfHighlightedKeywords: z.number().nonnegative(),
    getSummary: z.object({}),
    getSummaryResponse: z.object({
        /**
         * The summary of the data.
         */
        summary: SummaryInfoSchema,
    }),
    displaySettingsChanged: z.object({
        /**
         * When true, we will display the guids.
         */
        displayGuids: z.boolean().nullable(),

        /**
         * When true, we will display the file names, when `null` the setting is not changed.
         */
        displayFileNames: z.boolean().nullable(),

        /**
         * When true, we will display the dates in line, when `null` the setting is not changed.
         */
        displayDatesInLine: z.boolean().nullable(),

        /**
         * When true, we will display the log levels in the log, when `null` the setting is not changed.
         */
        displayLogLevels: z.boolean().nullable(),

        /**
         * When true, we will display the readable dates, when `null` the setting is not changed.
         */
        displayReadableDates: z.boolean().nullable(),

        /**
         * When true, we will display the log entry number, when `null` the setting is not changed.
         */
        displayLogEntryNumber: z.boolean().nullable(),
    }),
    /**
     * Message sent from the webview to the extension to open the logs document.
     */
    openLogsDocument: z.undefined(),
    keywordHighlightStateChange: z.object({
        /**
         * The keyword to highlight.
         */
        keywordDefinition: KeywordHighlightSchema,

        /**
         * The state of the keyword highlight.
         */
        isChecked: z.boolean(),
    }),
    updateTimeFilters: z.object({
        /**
         * The time filter.
         */
        fromDate: z.string().nullable().optional(),

        /**
         * The time filter.
         */
        tillDate: z.string().nullable().optional(),
    }),
    /**
     * Acknowledges a message.
     */
    messageAck: z.undefined(),

    /**
     * Message sent from the extension to the webview to set the keyword filters from the configuration.
     */
    setKeywordFiltersFromConfiguration: z.array(
        z.object({
            /**
             * The value of the filter checkbox.
             */
            value: z.string(),

            /**
             * The state of the filter checkbox.
             */
            isChecked: z.boolean(),
        })
    ),

    /**
     * Message sent from the extension to the webview to set the keyword highlights from the configuration.
     */
    setKeywordHighlightsFromConfiguration: z.array(
        z.object({
            /**
             * The keyword to highlight.
             */
            keywordDefinition: KeywordHighlightSchema,

            /**
             * The state of the keyword highlight.
             */
            isChecked: z.boolean(),
        })
    ),
    updateKeywordHighlightConfiguration: z.object({
        /**
         * The type of update to perform.
         */
        updateType: ConfigurationUpdateSchema,

        /**
         * The keyword to highlight.
         */
        keywordDefinition: KeywordHighlightSchema,
    }),
    /**
     * Message sent from the webview to the extension to indicate that the webview is ready.
     * After receiving this message, the extension can send messages to the webview.
     */
    webviewReady: z.undefined(),

    /**
     * Message sent from the webview to the extension to indicate that there is no workspace folder.
     */
    noWorkspace: z.undefined(),

    /**
     * Message sent from the webview to the extension to select a workspace folder.
     * Sent after the user has clicked the button to open logs.
     * The data is the type of workspace folder to select.
     */
    selectWorkspaceFolder: z.union([z.literal("any"), z.literal("t21")]),

    /**
     * Message sent from the extension to the webview to indicate that the workspace is ready.
     */
    workspaceReady: z.undefined(),

    /**
     * Message sent from the extension to the webview to set the file list that users can filter by.
     */
    setFileList: z.array(LogFileNameSchema),

    /**
     * Message sent from the extension to the webview to update the file list from the configuration (e.g. Which files are checked).
     * If a file is part of the array it should be marked as filtered out (unchecked).
     */
    setFileListFromConfiguration: z.array(z.string()),

    /**
     * Message sent from the webview to the extension to update the file filter checkbox state.
     */
    updateFileFilterCheckboxState: LogFileNameWithStateSchema,

    /**
     * Message sent from the webview to the extension to open a specific log file.
     * The data is the file path to open.
     */
    openFile: z.string(),

    /**
     * Message sent from the extension to the webview to set the list of error log entries.
     */
    setErrorList: z.array(
        z.object({
            /**
             * The date of the log entry.
             */
            date: z.string().transform(value => new Date(value)),

            /**
             * The text of the log entry.
             */
            text: z.string(),

            /**
             * The service that generated the log entry. (This is a reduced file name).
             */
            service: z.string().nullable().optional(),

            /**
             * The file path of the log entry if it exists.
             */
            filePath: z.string().nullable().optional(),

            /**
             * The number of the row where the log entry is located.
             */
            rowNumber: z.number().optional(),

            /**
             * A list of strings that can be searched for in ADO, etc.
             */
            searchTerms: z.array(z.string()),
        })
    ),

    /**
     * Message sent from the webview to the extension to jump to a specific row in the log file.
     */
    jumpToRow: z.number().nonnegative(),

    /**
     * Message sent from the webview to the extension to open tabs in the browser to search for terms.
     */
    openSearchWindows: z.array(z.string()),
} as const;
