import { z } from "zod";

/**
 * The valid commands that can be sent between extension and webview.
 */
export const CommandIdSchema = z.union([
    z.literal("logMessage"),
    z.literal("logErrorMessage"),
    z.literal("filterCheckboxStateChange"),
    z.literal("updateNumberOfActiveFilters"),
    z.literal("getSummary"),
    z.literal("getSummaryResponse"),
]);

/**
 * The valid commands that can be sent between extension and webview.
 */
export type CommandId = z.TypeOf<typeof CommandIdSchema>;

/**
 * The schema for the message that is sent between the webview and the extension.
 */
export const PostMessageSchema = z.object({
    /**
     * The id of the message. This is used to identify the reply to the command.
     */
    id: z.string().uuid(),

    /**
     * The name of the command to execute
     */
    command: CommandIdSchema,

    /**
     * The payload data.
     */
    data: z.unknown(),
});

/**
 * The schema for the message that is sent between the webview and the extension with unknown data.
 */
export type PostMessageWithUnknownData = z.TypeOf<typeof PostMessageSchema>;
