export type KeywordHighlight = {
    /**
     * The keyword to highlight.
     */
    keyword: string;

    /**
     * The color to use for highlighting.
     */
    color: string;
};

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

