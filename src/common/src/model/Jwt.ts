/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { z } from "zod";

/**
 * A minimal schema for a JSON Web Token (JWT).
 */
export const JwtSchema = z.object({
    /**
     * The audience of the token. This is the intended recipient of the token.
     */
    aud: z.string(),

    /**
     * The time the token was issued.
     */
    iat: z.number().transform(value => new Date(value * 1000)),

    /**
     * The time the token expires.
     */
    exp: z.number().transform(value => new Date(value * 1000)),

    /**
     * The scopes that the token gives access to.
     */
    scp: z.string().optional(),
});

