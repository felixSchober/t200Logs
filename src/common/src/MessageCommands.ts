import { z } from "zod";
import { MessageSchemaMap } from "./MessageSchemaMap";
import { CommandId } from "./PostMessageSchema";

/**
 * Utility type that takes a command id and returns the type of the data that is sent with the command.
 */
export type GetCommandById<T extends CommandId> = {
    command: T;
    data: CommandIdToData<T>;
};

/**
 * A union type of all the message commands that can be sent to the webview
 * - `FilterCheckboxStateChangeCommand` - A command to change the state of a filter checkbox
 * - `UpdateNumberOfActiveFiltersCommand` - A command to update the number of active filters (Response of `FilterCheckboxStateChangeCommand`)
 * - `LogMessageCommand` - A command to log a message from webview to the extension
 * - `LogErrorMessageCommand` - A command to log a error message from webview to the extension
 * - `GetSummaryCommand` - A command to get the summary of the data
 * - `GetSummaryResponseCommand` - A command to send the summary of the data
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
     * The id of the message
     */
    id: string;
};

/**
 * Utility type that takes a command id and returns the type of the data that is sent with the command.
 */
export type CommandIdToData<T extends CommandId> = z.TypeOf<(typeof MessageSchemaMap)[T]>;

