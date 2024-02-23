/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { z } from "zod";

const harHeaderSchema = z.object({
    name: z.string(),
    value: z.string(),
});

const harRequestSchema = z.object({
    method: z.string(),
    url: z.string(),
    httpVersion: z.string(),
    headers: z.array(harHeaderSchema),
    queryString: z.array(
        z.object({
            name: z.string(),
            value: z.string(),
        })
    ),
    postData: z.object({
        mimeType: z.string(),
        text: z.string(),
    }),
    headersSize: z.number(),
    bodySize: z.number(),
});

const harResponseSchema = z.object({
    status: z.number().positive(),
    statusText: z.string(),
    httpVersion: z.string(),
    headers: z.array(harHeaderSchema),
    content: z.object({
        size: z.number(),
        mimeType: z.string(),
        text: z.string(),
    }),
    serverIPAddress: z.string(),
    startedDateTime: z.string(),
    time: z.number(),
    headersSize: z.number(),
    bodySize: z.number(),
});

export const harEntrySchema = z.object({
    startedDateTime: z.string(),
    time: z.number(),
    request: harRequestSchema,
    response: harResponseSchema,
    cache: z.object({
        beforeRequest: z.object({
            lastAccess: z.string(),
            eTag: z.string(),
            hitCount: z.number(),
        }),
        afterRequest: z.object({
            lastAccess: z.string(),
            eTag: z.string(),
            hitCount: z.number(),
        }),
    }),
});

export const harSchema = z.object({
    log: z.object({
        version: z.string(),
        creator: z.object({
            name: z.string(),
            version: z.string(),
        }),
        entries: z.array(harEntrySchema),
    }),
});

export type HarEntry = z.infer<typeof harEntrySchema>;
