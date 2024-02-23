/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { z } from "zod";

import { MessageSchemaMap } from "./MessageSchemaMap";
import { CommandId } from "./PostMessageSchema";

/**
 * Utility type that takes a command id and returns the type of the data that is sent with the command.
 */
export type GetCommandById<T extends CommandId> = {
    /**
     * The command id. This is used to identify the command.
     */
    command: T;
    /**
     * The data that is sent with the command.
     */
    data: CommandIdToData<T>;
};

/**
 * A union type of all the message commands that can be sent to the webview
 * - `FilterCheckboxStateChangeCommand` - A command to change the state of a filter checkbox
 * - `filterLogLevel` - A command to filter the log level
 * - `filterTime` - A command to filter the time
 * - `filterSessionId` - A command to filter the session id
 * - `filterNoEventTime` - A command to turn off/on hiding events without a time
 * - `UpdateNumberOfActiveFilters` - A command to update the number of active filters (Response of `FilterCheckboxStateChangeCommand`)
 * - `LogMessage` - A command to log a message from webview to the extension
 * - `LogErrorMessage` - A command to log a error message from webview to the extension
 * - `GetSummary` - A command to get the summary of the data
 * - `GetSummaryResponse` - A command to send the summary of the data
 * - `DisplaySettingsChanged` - A command to notify the extension that the display settings have changed
 * - `OpenLogsDocument` - A command to open the logs document
 * - `updateTimeFilters` - A command to update the time filters in the webview. This is usually sent when the time filter was programmatically changed in the LogContentProvider.
 *
 * @example
 *
 * { command: "filterCheckboxStateChange", data: FilterCheckboxStateChangeData } | { command: "LogMessageCommand", data: { message: "" } } | ...
 *
 */
export type MessageCommand = {
    [K in CommandId]: GetCommandById<K>;
}[CommandId];

/**
 * Internal type of command used to communicate between the webview and the extension.
 * The command id is used to identify the reply to the command.
 */
export type PostMessageCommand<TId extends CommandId> = GetCommandById<TId> & {
    /**
     * The id of the message.
     */
    id: string;
};

/**
 * Utility type that takes a command id and returns the type of the data that is sent with the command.
 */
export type CommandIdToData<T extends CommandId> = z.TypeOf<(typeof MessageSchemaMap)[T]>;

