/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";

/**
 * Custom hook for debouncing a value.
 * @template T - The type of the value to be debounced.
 * @param value The value to be debounced.
 * @param [delay] The delay in milliseconds for debouncing. Defaults to 500 milliseconds.
 * @returns The debounced value.
 * @see [Documentation](https://usehooks-ts.com/react-hook/use-debounce)
 * @example
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 * @deprecated UseDebounce uses a naive setTimeout implementation and will be removed.
 * For a more robust implementation, use useDebounceCallback for functions and useDebounceValue for primitive values instead. The new implementation uses lodash.debounce under the hood.
 */
export function useDebounce<T>(value: T, delay?: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
    const timerRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            setDebouncedValue(prev => {
                if (prev !== value) {
                    return value;
                }
                return prev;
            });
        }, delay ?? 500);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [value, delay]);

    return debouncedValue;
}
