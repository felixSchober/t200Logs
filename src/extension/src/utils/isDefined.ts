/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/**
 * Checks if a value is defined (not `null` or `undefined`).
 * This is useful for filtering out `null` or `undefined` values from an array.
 * @param value The value to check.
 * @returns `true` if the value is defined, `false` otherwise.
 * @example
 * const values: (number | undefined | null)[] = [1, null, 2, undefined, 3];
 * const definedValues: number = values.filter(isDefined);
 */
export function isDefined<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}