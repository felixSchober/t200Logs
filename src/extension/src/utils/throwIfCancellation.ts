/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { CancellationError, CancellationToken } from "vscode";

/**
 * Throws an error if the given token is cancelled.
 * @param token The cancellation token.
 */
export const throwIfCancellation = (token?: CancellationToken) => {
    if (token?.isCancellationRequested) {
        console.log("Cancellation requested");
        throw new CancellationError();
    }
};
