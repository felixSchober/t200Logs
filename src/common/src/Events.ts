import { z } from "zod";
export const LogLevelSchema = z.union([z.literal("info"), z.literal("debug"), z.literal("warning"), z.literal("error")]);
export type LogLevel = z.TypeOf<typeof LogLevelSchema>;

export type DisplaySettingsChangedEvent = {
    /**
     * Whether to display the file names. A null value means that the user did not change the setting.
     */
    displayFileNames: boolean | null;

    /**
     * Whether to display the dates in line. A null value means that the user did not change the setting.
     */
    displayDatesInLine: boolean | null;

    /**
     * Whether to display the guids. A null value means that the user did not change the setting.
     */
    displayGuids: boolean | null;
};

export type FilterKeywordChangedEvent = {
    /**
     * The id of the checkbox.
     */
    checkboxId: string;
    /**
     * The keyword filter.
     */
    keyword: string;
    /**
     * The state of the checkbox.
     */
    isChecked: boolean;
};

/**
 * The event that is fired when the filter changes.
 */
export type FilterChangedEvent = {
    /**
     * The time filter.
     */
    fromDate?: string;

    /**
     * The time filter.
     */
    tillDate?: string;

    /**
     * When true, removes all entries that do not have an event time.
     */
    removeEntriesWithNoEventTime?: boolean;

    /**
     * Adds a keyword to the filter.
     */
    addKeywordFilter?: string;

    /**
     * Removes a keyword from the filter.
     */
    removeKeywordFilter?: string;

    /**
     * Adds a log level.
     */
    addLogLevel?: LogLevel;

    /**
     * Removes a log level.
     */
    removeLogLevel?: LogLevel;

    /**
     * If not `undefined` we will try to set a session id filter.
     */
    setSessionIdFilter?: string;

    /**
     * If not `undefined` we will try to remove a session id filter.
     */
    removeSessionIdFilter?: string;
};

/**
 * The event that is fired when the filter changes.
 */
export type TimeFilterChangedEvent = Pick<FilterChangedEvent, "fromDate" | "tillDate">;

