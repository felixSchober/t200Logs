/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { z } from "zod";

/**
 * A key-value pair representing a single HTTP Archive (HAR) header.
 */
const HarHeaderSchema = z.object({
    /**
     * The name of the header.
     */
    name: z.string(),

    /**
     * The value of the header.
     */
    value: z.string(),
});

const HarRequestSchema = z.object({
    /**
     * The method of the request.
     */
    method: z.string(),
    /**
     * The URL of the request.
     */
    url: z.string(),
    /**
     * The HTTP version of the request.
     */
    httpVersion: z.string(),
    /**
     * The headers of the request.
     */
    headers: z.array(HarHeaderSchema),
    
    /**
     * A list of query string parameters.
     */
    queryString: z.array(
        z.object({
            /**
             * The name of the query string parameter.
             */
            name: z.string(),

            /**
             * The value of the query string parameter.
             */
            value: z.string(),
        })
    ),
    /**
     * The post data of the request.
     */
    postData: z
        .object({
            mimeType: z.string(),
            text: z.string(),
        })
        .optional(),

        /**
         * The size of the request headers.
         */
    headersSize: z.number(),

    /**
     * The size of the request body.
     */
    bodySize: z.number(),
});

/**
 * A minimal schema for a single HTTP Archive (HAR) response.
 */
const HarResponseSchema = z.object({
    /**
     * The status of the response.
     */
    status: z.number().nonnegative(),

    /**
     * The status text of the response.
     */
    statusText: z.string(),
    /**
     * The HTTP version of the response.
     */
    httpVersion: z.string(),
    /**
     * The headers of the response.
     */
    headers: z.array(HarHeaderSchema),
    /**
     * The content of the response.
     */
    content: z.object({
        /**
         * The size of the response body.
         */
        size: z.number(),

        /**
         * The MIME type of the response.
         */
        mimeType: z.string(),

        /**
         * The text content of the response.
         */
        text: z.string().optional(),
    }),

    /**
     * The size of the response headers.
     */
    headersSize: z.number(),

    /**
     * The size of the response body.
     */
    bodySize: z.number(),
});

/**
 * A minimal schema for a single HTTP Archive (HAR) entry denoting a single request and response.
 */
export const HarEntrySchema = z.object({
    /**
     * The time the request was started.
     */
    startedDateTime: z.string(),

    /**
     * The time the request took to complete.
     */
    time: z.number(),

    /**
     * The request details.
     */
    request: HarRequestSchema,

    /**
     * The response details.
     */
    response: HarResponseSchema,

    /**
     * The server's IP address.
     */
    serverIPAddress: z.string(),
});

/**
 * A minimal schema for a HTTP Archive (HAR) file.
 */
export const HarSchema = z.object({
    log: z.object({
        /**
         * The version of the HAR file.
         */
        version: z.string(),

        /**
         * The creator of the HAR file.
         */
        creator: z.object({
            /**
             * The name of the creator.
             */
            name: z.string(),

            /**
             * The version of the creator.
             */
            version: z.string(),
        }),

        /**
         * A list of all entries in the HAR file.
         * Each entry denotes a single request and response.
         */
        entries: z.array(HarEntrySchema),
    }),
});

/**
 * A minimal type for a single HTTP Archive (HAR) entry denoting a single request and response.
 */
export type HarEntry = z.infer<typeof HarEntrySchema>;








