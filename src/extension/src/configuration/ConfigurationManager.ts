/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { KeywordFilter, KeywordHighlightWithIsChecked } from "@t200logs/common";
import { workspace } from "vscode";

import {
    EXTENSION_ID,
    KEYWORD_FILTER_CONFIGURATION_SETTING_NAME,
    KEYWORD_HIGHLIGHT_CONFIGURATION_SETTING_NAME,
    WELCOME_MESSAGE_CONFIGURATION_SETTING_NAME,
} from "../constants/constants";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";

/**
 * Manages the configuration for the extension.
 */
export class ConfigurationManager {
    private _keywordHighlights: KeywordHighlightWithIsChecked[] | undefined;
    private _keywordFilters: KeywordFilter[] | undefined;
    private _shouldShowWelcomeMessage: boolean | undefined;
    private readonly logger: ScopedILogger;

    /**
     * Creates a new configuration manager for the given workspace folder.
     * @param logger The logger to use for logging.
     */
    constructor(logger: ITelemetryLogger) {
        this.logger = logger.createLoggerScope("ConfigurationManager");
    }

    /**
     * Returns the configuration of keyword highlights to use for highlighting.
     * @returns The configuration of keyword highlights to use for highlighting.
     */
    public get keywordHighlights(): KeywordHighlightWithIsChecked[] {
        if (!this._keywordHighlights) {
            this.loadConfiguration();
        }
        return this._keywordHighlights || [];
    }

    /**
     * Sets the configuration of keyword highlights to use for highlighting.
     */
    public set keywordHighlights(value: KeywordHighlightWithIsChecked[]) {
        this._keywordHighlights = value;
        void this.storeConfiguration();
    }

    /**
     * Returns the configuration of keyword filters to use for filtering.
     * @returns The configuration of keyword filters to use for filtering.
     */
    public get keywordFilters(): KeywordFilter[] {
        if (!this._keywordFilters) {
            this.loadConfiguration();
        }
        return this._keywordFilters || [];
    }

    /**
     * Sets the configuration of keyword filters to use for filtering.
     */
    public set keywordFilters(value: KeywordFilter[]) {
        this._keywordFilters = value;
        void this.storeConfiguration();
    }

    /**
     * Returns whether the welcome message should be shown.
     * @returns Whether the welcome message should be shown.
     */
    public get shouldShowWelcomeMessage(): boolean {
        if (this._shouldShowWelcomeMessage === undefined) {
            this.loadConfiguration();
        }
        return this._shouldShowWelcomeMessage || true;
    }

    /**
     * Sets whether the welcome message should be shown.
     */
    public set shouldShowWelcomeMessage(value: boolean) {
        this._shouldShowWelcomeMessage = value;
        void this.storeConfiguration();
    }

    /**
     * Loads the configuration from the workspace.
     */
    private loadConfiguration() {
        this.logger.info("loadConfiguration.start");
        const configuration = workspace.getConfiguration(EXTENSION_ID);

        this._keywordHighlights = configuration.get<KeywordHighlightWithIsChecked[]>(KEYWORD_HIGHLIGHT_CONFIGURATION_SETTING_NAME);
        this._keywordFilters = configuration.get<KeywordFilter[]>(KEYWORD_FILTER_CONFIGURATION_SETTING_NAME);
        this._shouldShowWelcomeMessage = configuration.get<boolean>(WELCOME_MESSAGE_CONFIGURATION_SETTING_NAME);
    }

    /**
     * Stores the configuration to the workspace.
     */
    private async storeConfiguration() {
        this.logger.info("storeConfiguration.start", undefined, {
            keywordHighlights: this._keywordHighlights?.map(kw => `${kw.keyword} - ${kw.color}`).join(", "),
            keywordFilters: this._keywordFilters?.map(kw => `${kw.keyword} - ${kw.isChecked}`).join(", "),
            shouldShowWelcomeMessage: "" + this._shouldShowWelcomeMessage,
        });
        const configuration = workspace.getConfiguration(EXTENSION_ID);
        await configuration.update(KEYWORD_HIGHLIGHT_CONFIGURATION_SETTING_NAME, this._keywordHighlights);
        await configuration.update(KEYWORD_FILTER_CONFIGURATION_SETTING_NAME, this._keywordFilters);
        await configuration.update(WELCOME_MESSAGE_CONFIGURATION_SETTING_NAME, this._shouldShowWelcomeMessage);
    }
}


