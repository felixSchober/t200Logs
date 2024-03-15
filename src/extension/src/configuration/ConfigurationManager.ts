/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { IPostMessageService, KeywordFilter, KeywordHighlightWithIsChecked } from "@t200logs/common";
import { workspace } from "vscode";

import {
    EXTENSION_ID,
    KEYWORD_FILTER_CONFIGURATION_SETTING_NAME,
    KEYWORD_HIGHLIGHT_CONFIGURATION_SETTING_NAME,
    WELCOME_MESSAGE_CONFIGURATION_SETTING_NAME,
} from "../constants/constants";
import { PostMessageDisposableService } from "../service/PostMessageDisposableService";
import { WorkspaceService } from "../service/WorkspaceService";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";

import { DocumentLocationManager } from "./DocumentLocationManager";
import { ProjectConfigurationManager } from "./ProjectConfigurationManager";

/**
 * Manages the configuration for the extension.
 */
export class ConfigurationManager extends PostMessageDisposableService {
    private _keywordHighlights: KeywordHighlightWithIsChecked[] | undefined;
    private _keywordFilters: KeywordFilter[] | undefined;
    private _shouldShowWelcomeMessage: boolean | undefined;

    private readonly projectConfiguration: ProjectConfigurationManager;
    private readonly logger: ScopedILogger;

    /**
     * Creates a new configuration manager for the given workspace folder.
     * @param logger The logger to use for logging.
     * @param workspaceService The workspace service to use for getting the workspace folder.
     * @param documentLocationManager The document location manager to use for listening to configuration changes.
     */
    constructor(logger: ITelemetryLogger, workspaceService: WorkspaceService, documentLocationManager: DocumentLocationManager) {
        super();
        this.logger = logger.createLoggerScope("ConfigurationManager");
        this.projectConfiguration = new ProjectConfigurationManager(logger, workspaceService, documentLocationManager);
    }

    /**
     * Initializes the configuration manager.
     */
    public async initialize() {
        this.logger.info("initialize");
        this.loadSettings();
        await this.projectConfiguration.initialize();
        this.logger.info("initialize.done");
    }

    /**
     * Sets up the listeners for the post message service.
     * @param postMessageService The post message service to use for listening to configuration changes.
     */
    public addPostMessageService(postMessageService: IPostMessageService) {
        this.logger.info("addPostMessageService");
        this.projectConfiguration.addPostMessageService(postMessageService);
        const unregisterFilterChangedHandler = postMessageService.registerMessageHandler("updateFilterCheckboxState", (data, respond) => {
            this.logger.info("updateFilterCheckboxState", `filter ${data.updateType} -> ${data.value}`, { event: JSON.stringify(data) });
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
            respond({ command: "messageAck", data: undefined });
        });
        this.unregisterListeners.push(unregisterFilterChangedHandler);

        const unregisterHighlightChangedHandler = postMessageService.registerMessageHandler(
            "updateKeywordHighlightConfiguration",
            (data, respond) => {
                this.logger.info("updateKeywordHighlightConfiguration", undefined, { event: JSON.stringify(data) });
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
                            this.logger.logException(
                                "updateKeywordHighlightConfiguration.add",
                                new Error(`Keyword ${data.keywordDefinition.keyword} already exists`)
                            );
                        }
                        break;
                    case "remove":
                        if (index !== -1) {
                            currentHighlights.splice(index, 1);
                        } else {
                            this.logger.logException(
                                "updateKeywordHighlightConfiguration.remove",
                                new Error(`Keyword ${data.keywordDefinition.keyword} does not exist`)
                            );
                        }
                        break;
                    case "update":
                        if (index !== -1) {
                            currentHighlights[index] = {
                                ...data.keywordDefinition,
                                isChecked: true,
                            };
                        } else {
                            this.logger.logException(
                                "updateKeywordHighlightConfiguration.update",
                                new Error(`Keyword ${data.keywordDefinition.keyword} does not exist`)
                            );
                        }
                        break;
                }

                this.keywordHighlights = currentHighlights;
                respond({ command: "messageAck", data: undefined });
            }
        );
        this.unregisterListeners.push(unregisterHighlightChangedHandler);
    }

    /**
     * Returns the configuration of keyword highlights to use for highlighting.
     * @returns The configuration of keyword highlights to use for highlighting.
     */
    public get keywordHighlights(): KeywordHighlightWithIsChecked[] {
        if (!this._keywordHighlights) {
            this.loadSettings();
        }

        const enabledProjectHighlights = this.projectConfiguration.configuration.enabledKeywordHighlights;

        const definitions = this._keywordHighlights || enabledProjectHighlights;
        const allHighlights: KeywordHighlightWithIsChecked[] = [];

        // merge the project configuration with the settings configuration
        // enable all the highlights that are enabled in the project configuration
        // and disable all the highlights that are disabled in the project configuration
        for (const highlight of definitions) {
            const projectHighlight = enabledProjectHighlights.find(kw => kw.keyword === highlight.keyword);
            if (projectHighlight) {
                allHighlights.push({
                    ...highlight,
                    isChecked: true,
                });
            } else {
                allHighlights.push({
                    ...highlight,
                    isChecked: false,
                });
            }
        }

        return allHighlights;
    }

    /**
     * Sets the configuration of keyword highlights to use for highlighting.
     */
    public set keywordHighlights(value: KeywordHighlightWithIsChecked[]) {
        this._keywordHighlights = value;
        void this.storeSettings();
    }

    /**
     * Returns the configuration of keyword filters to use for filtering.
     * @returns The configuration of keyword filters to use for filtering.
     */
    public get keywordFilters(): KeywordFilter[] {
        if (!this._keywordFilters) {
            this.loadSettings();
        }
        const enabledProjectFilters = this.projectConfiguration.configuration.enabledKeywordFilters;
        const settingsFilters = this._keywordFilters || [];
        // merge the project configuration with the settings configuration
        // enable all the filters that are enabled in the project configuration
        // and disable all the filters that are disabled in the project configuration
        const keywordsToIterateOver = new Set([...enabledProjectFilters, ...settingsFilters.map(kw => kw.keyword)]);

        for (const keyword of keywordsToIterateOver) {
            const projectFilter = enabledProjectFilters.includes(keyword);
            const settingsFilter = settingsFilters.find(kw => kw.keyword === keyword);
            if (settingsFilter) {
                settingsFilter.isChecked = projectFilter;
            } else {
                // if the keyword is not present in the settings configuration, add it
                settingsFilters.push({
                    keyword,
                    isChecked: projectFilter,
                });
            }
        }

        return settingsFilters;
    }

    /**
     * Sets the configuration of keyword filters to use for filtering.
     */
    public set keywordFilters(value: KeywordFilter[]) {
        this._keywordFilters = value;
        void this.storeSettings();
    }

    /**
     * Returns a list of disabled log levels.
     * @returns A list of disabled log levels.
     */
    public get disabledLogLevels() {
        return this.projectConfiguration.configuration.disabledLogLevels;
    }

    /**
     * Returns the time filters that are enabled for the project.
     * @returns An object containing the time filters that are enabled for the project.
     */
    public get enabledTimeFilters() {
        return this.projectConfiguration.configuration.enabledTimeFilters;
    }

    /**
     * Returns the disabled files for the project.
     * @returns List of file names that are disabled for the project.
     */
    public get disabledFiles() {
        return this.projectConfiguration.configuration.disabledFiles;
    }

    /**
     * The saved cursor position from the last session.
     *
     * Important: Do not use this property more than once. Changing the cursor position during the same session
     * is a bad user experience. This property is only used to restore the cursor position from the last session.
     * @returns The saved cursor position from the last session.
     */
    public get restoredCursorPosition() {
        return this.projectConfiguration.configuration.cursorPosition;
    }

    /**
     * Returns whether the welcome message should be shown.
     * @returns Whether the welcome message should be shown.
     */
    public get shouldShowWelcomeMessage(): boolean {
        if (this._shouldShowWelcomeMessage === undefined) {
            this.loadSettings();
        }
        return this._shouldShowWelcomeMessage || true;
    }

    /**
     * Sets whether the welcome message should be shown.
     */
    public set shouldShowWelcomeMessage(value: boolean) {
        this._shouldShowWelcomeMessage = value;
        void this.storeSettings();
    }

    /**
     * Disposes the configuration manager.
     */
    public override dispose() {
        super.dispose();
        this.projectConfiguration.dispose();
    }

    /**
     * Loads the settings configuration from the workspace.
     */
    private loadSettings() {
        this.logger.info("loadConfiguration.start");
        const configuration = workspace.getConfiguration(EXTENSION_ID);

        this._keywordHighlights = configuration.get<KeywordHighlightWithIsChecked[]>(KEYWORD_HIGHLIGHT_CONFIGURATION_SETTING_NAME);
        this._keywordFilters = configuration.get<KeywordFilter[]>(KEYWORD_FILTER_CONFIGURATION_SETTING_NAME);
        this._shouldShowWelcomeMessage = configuration.get<boolean>(WELCOME_MESSAGE_CONFIGURATION_SETTING_NAME);
    }

    /**
     * Stores the settings configuration to the workspace.
     */
    private async storeSettings() {
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
