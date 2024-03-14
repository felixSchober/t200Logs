/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as path from "path";

import { IPostMessageService } from "@t200logs/common";
import { Uri, workspace } from "vscode";

import { PostMessageDisposableService } from "../service/PostMessageDisposableService";
import { WorkspaceService } from "../service/WorkspaceService";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";

import { DocumentLocationManager } from "./DocumentLocationManager";
import {
    ProjectConfiguration,
    ProjectConfigurationSchemaVersion,
    ValidProjectConfigurationVersion,
    emptyProjectConfiguration,
    getMostRecentConfiguration,
} from "./ProjectConfigurationSchema";

/**
 * The name of the configuration file to use for the project.
 */
const CONFIGURATION_FILE_NAME = "t200logs.json";

/**
 * Class to store the current log state of the project inside the current workspace.
 *
 * When the user opens the project again, the state will be restored.
 */
export class ProjectConfigurationManager extends PostMessageDisposableService {
    /**
     * Logger instance for the class.
     */
    private readonly logger: ScopedILogger;

    private _projectConfiguration: ProjectConfiguration | undefined;

    /**
     * Creates a new configuration manager.
     * @param logger The logger to use for logging.
     * @param workspaceService The workspace service to use for getting the workspace folder.
     * @param documentLocationManager The document location manager to use for getting the current cursor position.
     */
    constructor(
        logger: ITelemetryLogger,
        private readonly workspaceService: WorkspaceService,
        private readonly documentLocationManager: DocumentLocationManager
    ) {
        super();
        this.logger = logger.createLoggerScope("ProjectConfigurationManager");

        this.documentLocationManager.onRangeChanged.event(e => {
            this.setConfigurationKey("cursorPosition", e.midpoint);
        });
    }

    /**
     * Sets up the listeners for the post message service.
     * @param postMessageService The post message service to use for listening to configuration changes.
     */
    public addPostMessageService(postMessageService: IPostMessageService) {
        this.logger.info("addPostMessageService");

        // LOG LEVEL FILTER
        const unregisterLogLevelChanged = postMessageService.registerMessageHandler("filterLogLevel", event => {
            this.logger.info(`filterLogLevel.${event.logLevel}.changed`, `enabled: ${event.isChecked}`);

            let disabledLogLevels = this.configuration.disabledLogLevels;

            if (event.isChecked && disabledLogLevels.includes(event.logLevel)) {
                disabledLogLevels = disabledLogLevels.filter(level => level !== event.logLevel);
            }
            if (!event.isChecked && !disabledLogLevels.includes(event.logLevel)) {
                disabledLogLevels.push(event.logLevel);
            }
            this.setConfigurationKey("disabledLogLevels", disabledLogLevels);
        });
        this.unregisterListeners.push(unregisterLogLevelChanged);

        // KEYWORD FILTER
        const unregisterKeywordFilterChanged = postMessageService.registerMessageHandler("updateFilterCheckboxState", data => {
            this.logger.info("updateFilterCheckboxState", `filter ${data.updateType} -> ${data.value}`, { event: JSON.stringify(data) });
            const currentFilters = this.configuration.enabledKeywordFilters;

            // check if the keyword is already present in the list
            const index = currentFilters.findIndex(kw => kw === data.value);
            switch (data.updateType) {
                case "add":
                    if (index === -1) {
                        currentFilters.push(data.value);
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
                    // found a keyword and it was disabled -> remove it
                    if (index !== -1) {
                        currentFilters.splice(index, 1);
                        this.logger.info("updateFilterCheckboxState.update", `filter ${data.value} removed`, {
                            event: JSON.stringify(data),
                        });
                    }

                    // found a keyword and it was enabled -> add it
                    if (index === -1) {
                        currentFilters.push(data.value);
                        this.logger.info("updateFilterCheckboxState.update", `filter ${data.value} added`, { event: JSON.stringify(data) });
                    }
            }

            this.setConfigurationKey("enabledKeywordFilters", currentFilters);
        });
        this.unregisterListeners.push(unregisterKeywordFilterChanged);

        // TIME FILTER (set by the user in the webview panel)
        const unregisterTimeFilterChanged = postMessageService.registerMessageHandler("filterTime", data => {
            this.logger.info("filterTime", `from ${data.fromDate?.toString()} to ${data.tillDate?.toString()}`, {
                event: JSON.stringify(data),
            });
            this.setConfigurationKey("enabledTimeFilters", data);
        });
        this.unregisterListeners.push(unregisterTimeFilterChanged);

        // TIME FILTER (set by the log content provider)
        const unregisterTimeFilterChangedEvent = postMessageService.registerMessageHandler("updateTimeFilters", data => {
            this.logger.info("updateTimeFilters", `from ${data.fromDate?.toString()} to ${data.tillDate?.toString()}`, {
                event: JSON.stringify(data),
            });
            this.setConfigurationKey("enabledTimeFilters", data);
        });
        this.unregisterListeners.push(unregisterTimeFilterChangedEvent);

        // KEYWORD HIGHLIGHTS
        const unregisterHighlightChanged = postMessageService.registerMessageHandler("updateKeywordHighlightConfiguration", data => {
            this.logger.info("updateKeywordHighlightConfiguration", undefined, { event: JSON.stringify(data) });
            const currentHighlights = this.configuration.enabledKeywordHighlights;

            // check if the keyword is already present in the list
            const index = currentHighlights.findIndex(kw => kw.keyword === data.keywordDefinition.keyword);

            switch (data.updateType) {
                case "add":
                    if (index === -1) {
                        currentHighlights.push(data.keywordDefinition);
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
                        currentHighlights[index] = data.keywordDefinition;
                    } else {
                        // the keyword does not exist, so we add it (it was probably enabled by checking the checkbox in the webview panel)
                        currentHighlights.push(data.keywordDefinition);
                    }
                    break;
            }

            this.setConfigurationKey("enabledKeywordHighlights", currentHighlights);
        });
        this.unregisterListeners.push(unregisterHighlightChanged);

        const unregisterFileFilterChanged = postMessageService.registerMessageHandler("updateFileFilterCheckboxState", data => {
            this.logger.info("updateFileFilterCheckboxState", `filter ${data.fileName} -> ${data.isEnabled ? "ON" : "OFF"}`);
            const currentlyDisabledFiles = this.configuration.disabledFiles;

            // file was enabled -> remove it from the list
            if (data.isEnabled && currentlyDisabledFiles.includes(data.fileName)) {
                const index = currentlyDisabledFiles.findIndex(f => f === data.fileName);
                currentlyDisabledFiles.splice(index, 1);
            }

            // file was disabled -> add it to the list
            if (!data.isEnabled && !currentlyDisabledFiles.includes(data.fileName)) {
                currentlyDisabledFiles.push(data.fileName);
            }
            this.setConfigurationKey("disabledFiles", currentlyDisabledFiles);
        });
        this.unregisterListeners.push(unregisterFileFilterChanged);

        this.logger.info("addPostMessageService.success", undefined, { listeners: "" + this.unregisterListeners.length });
    }

    /**
     * The current project configuration.
     * @returns The current project configuration.
     */
    public get configuration(): ProjectConfiguration {
        return this._projectConfiguration || emptyProjectConfiguration;
    }

    /**
     * Sets the current project configuration.
     * @param value The new project configuration.
     */
    public set configuration(value: ProjectConfiguration | undefined) {
        this._projectConfiguration = value;
        void this.saveConfiguration();
    }

    /**
     * Sets a single configuration key to a new value.
     * @param key The key of the configuration to set.
     * @param value The value to set for the configuration key.
     */
    public setConfigurationKey<T extends keyof ProjectConfiguration>(key: T, value: ProjectConfiguration[T]) {
        if (!this._projectConfiguration) {
            this._projectConfiguration = emptyProjectConfiguration;
        }
        this._projectConfiguration[key] = value;
        void this.saveConfiguration();
    }

    /**
     * Loads the current project configuration from the configuration file.
     */
    public async initialize() {
        this.logger.info("initialize");
        const configurationFilePath = this.configurationFilePath;

        if (!configurationFilePath) {
            this.logger.info("initialize.noConfigurationFile");
            return;
        }

        // try opening the file - failing is expected if the file does not exist
        // In that case, we'll just create a new configuration file.
        let fileContent: string | undefined;
        try {
            const file = await workspace.fs.readFile(Uri.file(configurationFilePath));
            fileContent = file.toString();
        } catch (error) {
            this.logger.logException("initialize.fileError", error);
        }

        // if the file does not exist, create a new one
        if (!fileContent) {
            this.logger.info("initialize.createConfigurationFile");
            this._projectConfiguration = undefined;
            await this.saveConfiguration();
            return;
        }
        this.logger.info("initialize.fileContent", undefined, { content: fileContent });

        // parse the file content from a string to JSON and finally verify it against the schema
        let jsonContent: unknown;
        try {
            jsonContent = JSON.parse(fileContent);
            this.logger.info("initialize.parsed");
        } catch (parseError) {
            this.logger.logException(
                "initialize.parseError",
                parseError,
                "Failed to parse the local project configuration file.",
                {},
                true,
                "Configuration Error"
            );
            return;
        }

        const fileVersion = this.getConfigurationSchemaVersion(jsonContent);
        if (!fileVersion) {
            this._projectConfiguration = undefined;
            await this.saveConfiguration();
            return;
        }
        this.logger.info("initialize.version", undefined, { version: fileVersion });

        try {
            const [mostRecentConfiguration, wasMigrated] = getMostRecentConfiguration(fileVersion, jsonContent);
            this._projectConfiguration = mostRecentConfiguration;

            if (wasMigrated) {
                this.logger.info("initialize.migrated", undefined, { version: fileVersion });
                await this.saveConfiguration();
            }
        } catch (error) {
            this.logger.logException(
                "initialize.parseError",
                error,
                `Failed to parse the local project configuration file. You might have to delete the file and restart the extension. Error ${error?.toString?.()}`,
                {},
                true,
                "Configuration Error"
            );
            return;
        }

        this.logger.info("initialize.success", undefined, { configuration: JSON.stringify(this._projectConfiguration) });
    }

    /**
     * Saves the current project configuration to the configuration file.
     * If no configuration exists, a new one will be created.
     */
    public async saveConfiguration() {
        this.logger.info("saveConfiguration", undefined, { isDefined: `${!!this._projectConfiguration}` });
        let configuration: ProjectConfiguration | undefined = this._projectConfiguration;
        if (!configuration) {
            configuration = emptyProjectConfiguration;
            this._projectConfiguration = configuration;
        }

        let filePath = this.configurationFilePath;
        if (!filePath) {
            this.logger.info("saveConfiguration.noWorkspace");
            return;
        }

        // write the file
        const fileContent = JSON.stringify(configuration, null, 4);
        await workspace.fs.writeFile(Uri.file(filePath), Buffer.from(fileContent));
        this.logger.info("saveConfiguration.success");
    }

    /**
     * Extracts the version of the project configuration file.
     * @param jsonContent The `unknown` JSON content to verify.
     * @returns The version of the project configuration file or `undefined` if the version could not be verified.
     */
    private getConfigurationSchemaVersion(jsonContent: unknown): ValidProjectConfigurationVersion | undefined {
        const parseResults = ProjectConfigurationSchemaVersion.safeParse(jsonContent);
        if (parseResults.success) {
            return parseResults.data.version;
        }

        this.logger.logException(
            "getConfigurationSchemaVersion",
            new Error("Could not verify the project configuration file version."),
            `Failed to verify the local project configuration file version. Please delete the file and try again. Error ${parseResults.error.toString()}`,
            {},
            true,
            "Configuration Error"
        );
        return undefined;
    }

    /**
     * The path to the configuration file.
     * @returns The path to the configuration file or `undefined` if no workspace is open.
     */
    private get configurationFilePath(): string | undefined {
        if (!this.workspaceService.hasWorkspace) {
            this.logger.info("configurationFilePath.noWorkspace");
            return undefined;
        }
        return path.join(this.workspaceService.folder?.uri?.fsPath || "", CONFIGURATION_FILE_NAME);
    }
}

