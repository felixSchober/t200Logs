import { workspace } from "vscode";
import {
    EXTENSION_ID,
    KEYWORD_FILTER_CONFIGURATION_SETTING_NAME,
    KEYWORD_HIGHLIGHT_CONFIGURATION_SETTING_NAME,
    WELCOME_MESSAGE_CONFIGURATION_SETTING_NAME,
} from "../constants/constants";
import { KeywordFilter, KeywordHighlightWithIsChecked } from "@t200logs/common";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";

export class ConfigurationManager {
    private _keywordHighlights: KeywordHighlightWithIsChecked[] | undefined;
    private _keywordFilters: KeywordFilter[] | undefined;
    private _shouldShowWelcomeMessage: boolean | undefined;
    private readonly logger: ScopedILogger;

    /**
     * Creates a new configuration manager for the given workspace folder
     * @param workspaceFolder The workspace folder for which the configuration manager is being created
     */
    constructor(logger: ITelemetryLogger) {
        this.logger = logger.createLoggerScope("ConfigurationManager");
    }

    public get keywordHighlights(): KeywordHighlightWithIsChecked[] {
        if (!this._keywordHighlights) {
            this.loadConfiguration();
        }
        return this._keywordHighlights || [];
    }

    public set keywordHighlights(value: KeywordHighlightWithIsChecked[]) {
        this._keywordHighlights = value;
        this.storeConfiguration();
    }

    public get keywordFilters(): KeywordFilter[] {
        if (!this._keywordFilters) {
            this.loadConfiguration();
        }
        return this._keywordFilters || [];
    }

    public set keywordFilters(value: KeywordFilter[]) {
        this._keywordFilters = value;
        this.storeConfiguration();
    }

    public get shouldShowWelcomeMessage(): boolean {
        if (this._shouldShowWelcomeMessage === undefined) {
            this.loadConfiguration();
        }
        return this._shouldShowWelcomeMessage || true;
    }

    public set shouldShowWelcomeMessage(value: boolean) {
        this._shouldShowWelcomeMessage = value;
        this.storeConfiguration();
    }

    private loadConfiguration() {
        this.logger.info("loadConfiguration.start");
        const configuration = workspace.getConfiguration(EXTENSION_ID);

        this._keywordHighlights = configuration.get<KeywordHighlightWithIsChecked[]>(KEYWORD_HIGHLIGHT_CONFIGURATION_SETTING_NAME);
        this._keywordFilters = configuration.get<KeywordFilter[]>(KEYWORD_FILTER_CONFIGURATION_SETTING_NAME);
        this._shouldShowWelcomeMessage = configuration.get<boolean>(WELCOME_MESSAGE_CONFIGURATION_SETTING_NAME);
    }

    private storeConfiguration() {
        this.logger.info("storeConfiguration.start", undefined, {
            keywordHighlights: this._keywordHighlights?.map(kw => `${kw.keyword} - ${kw.color}`).join(", "),
            keywordFilters: this._keywordFilters?.map(kw => `${kw.keyword} - ${kw.isChecked}`).join(", "),
            shouldShowWelcomeMessage: "" + this._shouldShowWelcomeMessage,
        });
        const configuration = workspace.getConfiguration(EXTENSION_ID);
        configuration.update(KEYWORD_HIGHLIGHT_CONFIGURATION_SETTING_NAME, this._keywordHighlights);
        configuration.update(KEYWORD_FILTER_CONFIGURATION_SETTING_NAME, this._keywordFilters);
        configuration.update(WELCOME_MESSAGE_CONFIGURATION_SETTING_NAME, this._shouldShowWelcomeMessage);
    }
}

