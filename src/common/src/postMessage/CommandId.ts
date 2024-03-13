/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { z } from "zod";

/**
 * The valid commands that can be sent between extension and webview.
 * 
 * After adding a new command, you must also add it to the `MessageSchemaMap` type in `src/common/src/postMessage/MessageSchemaMap.ts`.
 */
export const CommandIdSchema = z.union([
    z.literal("logMessage"),
    z.literal("logErrorMessage"),
    z.literal("filterCheckboxStateChange"),
    z.literal("updateFilterCheckboxState"),
    z.literal("filterLogLevel"),
    z.literal("setLogLevelFromConfiguration"),
    z.literal("filterTime"),
    z.literal("filterSessionId"),
    z.literal("filterNoEventTime"),
    z.literal("updateNumberOfActiveFilters"),
    z.literal("getSummary"),
    z.literal("getSummaryResponse"),
    z.literal("displaySettingsChanged"),
    z.literal("openLogsDocument"),
    z.literal("keywordHighlightStateChange"),
    z.literal("updateNumberOfHighlightedKeywords"),
    z.literal("updateTimeFilters"),
    z.literal("messageAck"),
    z.literal("setKeywordFiltersFromConfiguration"),
    z.literal("setKeywordHighlightsFromConfiguration"),
    z.literal("updateKeywordHighlightConfiguration"),
    z.literal("webviewReady"),
    z.literal("noWorkspace"),
    z.literal("selectWorkspaceFolder"),
    z.literal("workspaceReady"),
]);



