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
    z.literal("logMessage"), // lets the ui log a message through the extension logger (ui -> extension)
    z.literal("logErrorMessage"), // lets the ui log an error message through the extension logger (ui -> extension)
    z.literal("filterCheckboxStateChange"), // lets the ui send a filter checkbox state change to the extension (ui -> extension)
    z.literal("updateFilterCheckboxState"), 
    z.literal("filterLogLevel"), // lets the ui send a log level filter to the extension (ui -> extension)
    z.literal("setLogLevelFromConfiguration"), // lets the extension send the log level filter to the ui (extension -> ui)
    z.literal("filterTime"), // lets the ui send a time filter to the extension (ui -> extension)
    z.literal("filterSessionId"), // lets the ui send a session id filter to the extension (ui -> extension)
    z.literal("filterNoEventTime"), 
    z.literal("updateNumberOfActiveFilters"), // lets the extension send the number of active filters to the ui (extension -> ui)
    z.literal("getSummary"), // lets the ui request a summary from the extension (ui -> extension)
    z.literal("getSummaryResponse"), // lets the extension send a summary to the ui (extension -> ui)
    z.literal("displaySettingsChanged"), // let's the extension know that display settings have changed (ui -> extension)
    z.literal("openLogsDocument"), // lets the extension know that the user wants to open the logs document (ui -> extension)
    z.literal("keywordHighlightStateChange"), // lets the ui send a keyword highlight state change to the extension (ui -> extension)
    z.literal("updateNumberOfHighlightedKeywords"), // lets the extension send the number of highlighted keywords to the ui (extension -> ui)
    z.literal("updateTimeFilters"),
    z.literal("messageAck"), // lets the extension send an ack to the ui (extension -> ui)
    z.literal("setKeywordFiltersFromConfiguration"), // lets the extension send the keyword filters to the ui (extension -> ui)
    z.literal("setKeywordHighlightsFromConfiguration"), // lets the extension send the keyword highlights to the ui (extension -> ui)
    z.literal("updateKeywordHighlightConfiguration"), // lets the ui send the keyword highlight configuration to the extension (ui -> extension)
    z.literal("webviewReady"), // lets the extension know that the webview is ready (ui -> extension)
    z.literal("noWorkspace"), // let's the ui know that there is no workspace (extension -> ui)
    z.literal("selectWorkspaceFolder"), // let's the extension know that the user wants to select a workspace folder (ui -> extension)
    z.literal("workspaceReady"),  
    z.literal("setFileList"), // Set the file list (extension -> ui)
    z.literal("setFileListFromConfiguration"), // Update the file list from the configuration (e.g. which files are checked) (extension -> ui)
    z.literal("updateFileFilterCheckboxState"), // Update the file filter checkbox state (ui -> extension)
    z.literal("openFile"), // Command to open a specific log file (ui -> extension)
    z.literal("setErrorList"), // sends the list of error log entries to the ui (extension -> ui)
]);



