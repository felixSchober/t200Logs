/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { z } from "zod";

import { CommandIdSchema } from "./CommandId";

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
     * The name of the command to execute.
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
