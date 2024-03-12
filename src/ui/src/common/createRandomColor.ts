/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/**
 * Create a random color in hex format.
 * @returns A random color in hex format.
 * @example
 * ```
 * const color = createRandomColor(); // #ff00ff
 * ```
 */
export const createRandomColor = (): string => {
    return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
};