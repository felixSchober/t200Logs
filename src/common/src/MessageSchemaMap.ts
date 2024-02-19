import { z } from "zod";
import { SummaryInfoSchema } from "./model";

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
    updateNumberOfActiveFilters: z.object({
        /**
         * The number of active filters
         */
        numberOfActiveFilters: z.number().positive(),
    }),
    getSummary: z.object({}),
    getSummaryResponse: z.object({
        /**
         * The summary of the data
         */
        summary: SummaryInfoSchema,
    }),
} as const;

