import { z } from "zod";

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
export type KeywordHighlightChangeEvent = {
    /**
     * Adds a keyword to the list of keywords to highlight.
     */
    addKeyword?: KeywordHighlight;

    /**
     * Removes a keyword from the list of keywords to highlight.
     */
    removeKeyword?: string;
};

