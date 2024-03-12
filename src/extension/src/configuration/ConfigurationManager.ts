/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { IPostMessageService, KeywordFilter, KeywordHighlightWithIsChecked } from "@t200logs/common";
import { Disposable, workspace } from "vscode";

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
export class ConfigurationManager implements Disposable{
    private _keywordHighlights: KeywordHighlightWithIsChecked[] | undefined;
    private _keywordFilters: KeywordFilter[] | undefined;
    private _shouldShowWelcomeMessage: boolean | undefined;
    private readonly logger: ScopedILogger;

    /**
     * List of functions which will unregister the listeners.
     */
    private readonly unregisterListeners: (() => void)[] = [];

    /**
     * Creates a new configuration manager for the given workspace folder.
     * @param logger The logger to use for logging.
     */
    constructor(logger: ITelemetryLogger) {
        this.logger = logger.createLoggerScope("ConfigurationManager");
    }
    

    /**
     * Sets up the listeners for the post message service.
     * @param postMessageService The post message service to use for listening to configuration changes.
     */
    public addPostMessageService(postMessageService: IPostMessageService) {
        this.logger.info("addPostMessageService");
        const unregisterFilterChangedHandler = postMessageService.registerMessageHandler("updateFilterCheckboxState", (data, respond) => {
            this.logger.info("updateFilterCheckboxState", `filter ${data.updateType} -> ${data.value}`, {event: JSON.stringify(data)});
            const currentFilters = this.keywordFilters;

            // check if the keyword is already present in the list
            const index = currentFilters.findIndex(kw => kw.keyword === data.value);

            switch (data.updateType) {
                case "add":
                    if (index === -1) {
                        currentFilters.push({
                            keyword: data.value,
                            isChecked: true,
                        });
                    } else {
                        this.logger.logException("updateFilterCheckboxState.add", new Error(`Keyword ${data.value} already exists`));
                    }
                    break;
                case "remove":
                    if (index !== -1) {
                        currentFilters.splice(index, 1);
                    } else {
                        this.logger.logException("updateFilterCheckboxState.remove", new Error(`Keyword ${data.value} does not exist`));
                    }
                    break;
                case "update":
                    if (index !== -1) {
                        currentFilters[index] = {
                            keyword: data.value,
                            isChecked: true,
                        };
                    } else {
                        this.logger.logException("updateFilterCheckboxState.update", new Error(`Keyword ${data.value} does not exist`));
                    }
                    break;
            }

            this.keywordFilters = currentFilters;
            respond({command: "messageAck", data: undefined});
        });
        this.unregisterListeners.push(unregisterFilterChangedHandler);

        const unregisterHighlightChangedHandler = postMessageService.registerMessageHandler("updateKeywordHighlightConfiguration", (data, respond) => {
            this.logger.info("updateKeywordHighlightConfiguration", undefined, {event: JSON.stringify(data)});
            const currentHighlights = this.keywordHighlights;

            // check if the keyword is already present in the list
            const index = currentHighlights.findIndex(kw => kw.keyword === data.keywordDefinition.keyword);

            switch (data.updateType) {
                case "add":
                    if (index === -1) {
                        currentHighlights.push({
                            ...data.keywordDefinition,
                            isChecked: true,
                        });
                    } else {
                        this.logger.logException("updateKeywordHighlightConfiguration.add", new Error(`Keyword ${data.keywordDefinition.keyword} already exists`));
                    }
                    break;
                case "remove":
                    if (index !== -1) {
                        currentHighlights.splice(index, 1);
                    } else {
                        this.logger.logException("updateKeywordHighlightConfiguration.remove", new Error(`Keyword ${data.keywordDefinition.keyword} does not exist`));
                    }
                    break;
                case "update":
                    if (index !== -1) {
                        currentHighlights[index] = {
                            ...data.keywordDefinition,
                            isChecked: true,
                        };
                    } else {
                        this.logger.logException("updateKeywordHighlightConfiguration.update", new Error(`Keyword ${data.keywordDefinition.keyword} does not exist`));
                    }
                    break;
            }

            this.keywordHighlights = currentHighlights;
            respond({command: "messageAck", data: undefined});
        });
        this.unregisterListeners.push(unregisterHighlightChangedHandler);
    }

    /**
     * Disposes of the resources used by the configuration manager.
     */
    dispose() {
        for (const unregisterListener of this.unregisterListeners) {
            unregisterListener();
        }
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


