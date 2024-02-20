import { z } from "zod";
import { MessageSchemaMap } from "../postMessage/MessageSchemaMap";

export const KeywordHighlightSchema = z.object({
    /**
     * The keyword to highlight.
     */
    keyword: z.string(),

    /**
     * The color to use for highlighting.
     */
    color: z.string(),
});

/**
 * The keyword to highlight.
 */
export type KeywordHighlight = z.TypeOf<typeof KeywordHighlightSchema>;

/**
 * Event that is fired the user adds or removes a keyword to highlight.
 */
export type KeywordHighlightChangeEvent = z.TypeOf<(typeof MessageSchemaMap)["keywordHighlightStateChange"]>;

