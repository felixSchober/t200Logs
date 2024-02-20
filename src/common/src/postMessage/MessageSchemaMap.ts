import { z } from "zod";
import { SummaryInfoSchema } from "../model";
import { LogLevelSchema } from "../Events";
import { KeywordHighlightSchema } from "../model/Keywords";

/**
 * Maps a command id to a schema for the data that is sent with the command.
 */
export const MessageSchemaMap = {
    logMessage: z.object({
        /**
         * Name of the event to log
         */
        event: z.string(),

        /**
         * The message to log
         */
        message: z.string(),
    }),
    logErrorMessage: z.object({
        /**
         * Name of the error to log
         */
        event: z.string(),

        /**
         * The error to log
         */
        errorMessage: z.string(),
    }),
    filterCheckboxStateChange: z.object({
        /**
         * The id of the filter checkbox
         */
        id: z.string(),

        /**
         * The value of the filter checkbox
         */
        value: z.string(),

        /**
         * The state of the filter checkbox
         */
        isChecked: z.boolean(),
    }),
    filterLogLevel: z.object({
        /**
         * The log level to filter
         */
        logLevel: LogLevelSchema,

        /**
         * The state of the log level filter
         */
        isChecked: z.boolean(),
    }),
    filterTime: z.object({
        /**
         * The time filter
         */
        fromDate: z.string().nullable().optional(),

        /**
         * The time filter
         */
        tillDate: z.string().nullable().optional(),
    }),
    filterSessionId: z.object({
        /**
         * The session id to filter
         */
        sessionId: z.string(),

        /**
         * The state of the session id filter
         */
        isChecked: z.boolean(),
    }),
    filterNoEventTime: z.object({
        /**
         * When true, removes all entries that do not have an event time.
         */
        removeEntriesWithNoEventTime: z.boolean(),
    }),
    updateNumberOfActiveFilters: z.number().positive(),
    updateNumberOfHighlightedKeywords: z.number().positive(),
    getSummary: z.object({}),
    getSummaryResponse: z.object({
        /**
         * The summary of the data
         */
        summary: SummaryInfoSchema,
    }),
    displaySettingsChanged: z.object({
        /**
         * When true, we will display the guids
         */
        displayGuids: z.boolean().nullable(),

        /**
         * When true, we will display the file names, when `null` the setting is not changed
         */
        displayFileNames: z.boolean().nullable(),

        /**
         * When true, we will display the dates in line, when `null` the setting is not changed
         */
        displayDatesInLine: z.boolean().nullable(),

        /**
         * When true, we will display the log levels in the log, when `null` the setting is not changed
         */
        displayLogLevels: z.boolean().nullable(),

        /**
         * When true, we will display the readable dates, when `null` the setting is not changed
         */
        displayReadableDates: z.boolean().nullable(),
    }),
    openLogsDocument: z.undefined(),
    keywordHighlightStateChange: z.object({
        /**
         * The keyword to highlight
         */
        keywordDefinition: KeywordHighlightSchema,

        /**
         * The state of the keyword highlight
         */
        isChecked: z.boolean(),
    }),
    updateTimeFilters: z.object({
        /**
         * The time filter
         */
        fromDate: z.string().nullable().optional(),

        /**
         * The time filter
         */
        tillDate: z.string().nullable().optional(),
    }),
    /**
     * Acknowledges a message
     */
    messageAck: z.undefined(),
} as const;

