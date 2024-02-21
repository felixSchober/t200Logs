import { z } from "zod";

/**
 * The valid commands that can be sent between extension and webview.
 */
export const CommandIdSchema = z.union([
    z.literal("logMessage"),
    z.literal("logErrorMessage"),
    z.literal("filterCheckboxStateChange"),
    z.literal("filterLogLevel"),
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
]);
