/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { z } from "zod";

export const SummaryInfoUserSchema = z.object({
    /**
     * The user principal name.
     * E.g "feschobe@microsoft.com".
     */
    upn: z.string().nullable(),

    /**
     * The user display name.
     */
    name: z.string().nullable(),

    /**
     * The user tenant id.
     */
    tenantId: z.string().nullable(),

    /**
     * The user object id.
     */
    oid: z.string().nullable(),

    /**
     * The user id.
     */
    userId: z.string().nullable(),
});

export type SummaryInfoUser = z.TypeOf<typeof SummaryInfoUserSchema>;

export const SummaryInfoSchema = z.object({
    /**
     * The session id.
     */
    sessionId: z.string().nullable(),

    /**
     * The device id.
     */
    deviceId: z.string().nullable(),

    /**
     * The host version.
     */
    hostVersion: z.string().nullable(),

    /**
     * The web version.
     */
    webVersion: z.string().nullable(),

    /**
     * The users language.
     */
    language: z.string().nullable(),

    /**
     * The users ring.
     */
    ring: z.string().nullable(),

    /**
     * The logged in users.
     */
    users: z.array(SummaryInfoUserSchema),
});

export type SummaryInfo = z.TypeOf<typeof SummaryInfoSchema>;
