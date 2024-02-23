/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";

import { useVSCodeApi } from "../vscode/useVSCodeApi";

/**
 * Hook to create a logger for a specific service.
 * @param service The service name to use in the logs (e.g. `"InfoPanelView"`).
 * @returns An object with `log` and `logError` functions to log messages.
 * @example
 * const { log, logError } = useLogger("InfoPanelView");
 */
export const useLogger = (service: string) => {
    const { messageService } = useVSCodeApi();

    return React.useMemo(() => {
        const log = (event: string, message: string) => {
            messageService.sendLogMessage(`${service}.${event}`, message);
        };

        const logError = (event: string, message: string) => {
            messageService.sendLogErrorMessage(`${service}.${event}`, message);
        };

        return {
            log,
            logError,
        };
    }, [messageService, service]);
};

