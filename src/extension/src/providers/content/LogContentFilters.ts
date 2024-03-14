/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { IPostMessageService, LogLevel, PostMessageEventRespondFunction, TimeFilterChangedEvent } from "@t200logs/common";
import * as vscode from "vscode";

import { ConfigurationManager } from "../../configuration/ConfigurationManager";
import { EPOCH_DATE } from "../../constants/constants";
import { PostMessageDisposableService } from "../../service/PostMessageDisposableService";
import { ScopedILogger } from "../../telemetry/ILogger";
import { ITelemetryLogger } from "../../telemetry/ITelemetryLogger";

import { LogEntry } from "./LogEntry";



/**
 * Filters for the LogContentProvider class.
 */
export class LogContentFilters extends PostMessageDisposableService {
    /**
     * A list of functions that should be called after {@link provideTextDocumentContent} is finished.
     */
    private readonly filterMessagesToRespondTo: PostMessageEventRespondFunction[] = [];

    /**
     * Filter out log entries that are before this date.
     * This field is the string representation of a date.
     */
    private _timeFilterFrom: string | null = null;

    /**
     * Sets both {@link _timeFilterFrom} and {@link timeFilterFromDate}.
     */
    public set timeFilterFrom(value: string | null) {
        this._timeFilterFrom = value;
        if (this._timeFilterFrom && !isNaN(Date.parse(this._timeFilterFrom))) {
            this.timeFilterFromDate = new Date(this._timeFilterFrom);
        } else {
            this.timeFilterFromDate = null;
        }
        this.postMessageService.sendAndForget({ command: "updateTimeFilters", data: { fromDate: value ?? null } });
    }

    /**
     * Date representation of {@link _timeFilterFrom}.
     */
    public timeFilterFromDate: Date | null = null;

    /**
     * The minimum date that can be used as a filter except if the user wants to display all entries.
     */
    private minimumDate: string | null = new Date(1000).toISOString();

    /**
     * Filter out log entries that are after this date.
     * This field is the string representation of a date.
     */
    private _timeFilterTill: string | null = null;

    /**
     * Sets both {@link _timeFilterTill} and {@link timeFilterTillDate}.
     */
    private set timeFilterTill(value: string | null) {
        this._timeFilterTill = value;
        if (this._timeFilterTill && !isNaN(Date.parse(this._timeFilterTill))) {
            this.timeFilterTillDate = new Date(this._timeFilterTill);
        } else {
            this.timeFilterTillDate = null;
        }
        this.postMessageService.sendAndForget({ command: "updateTimeFilters", data: { tillDate: value ?? null } });
    }

    /**
     * Date representation of {@link _timeFilterTill}.
     */
    public timeFilterTillDate: Date | null = null;

    /**
     * Filter out log entries that do not contain either of these keywords.
     */
    public keywordFilters: string[] = [];

    /**
     * The session id marks the starting point of the log entries to filter to.
     */
    private sessionId: string | null = null;

    /**
     * The currently disabled log levels.
     */
    public disabledLogLevels: LogLevel[] = [];

    private readonly logger: ScopedILogger;

    /**
     * Creates a new instance of the LogContentFilters class.
     * @param onFilterChangeEvent The event that is fired a filter changes through the code lens.
     * @param postMessageService The post message service to send messages to the webview.
     * @param configurationManager The configuration manager to get initial filter values from.
     * @param triggerDocumentChange The function to call when the filters change.
     * @param getLogEntries The function to call to get the log entries.
     * @param logger The logger to log events to.
     */
    constructor(
        private readonly onFilterChangeEvent: vscode.Event<TimeFilterChangedEvent>,
        private readonly postMessageService: IPostMessageService,
        private readonly configurationManager: ConfigurationManager,
        private readonly triggerDocumentChange: () => void,
        private readonly getLogEntries: () => LogEntry[],
        logger: ITelemetryLogger
    ) {
        super();
        this.logger = logger.createLoggerScope("LogContentFilters");

        // set the "timeFilterFrom" to a second after timestamp 0.
        // This is done so that we ignore all events that do not have a timestamp.
        this.timeFilterFrom = this.minimumDate;

        this.setupKeywordFiltersFromConfiguration();
        this.setupLogLevelFiltersFromConfiguration();
        this.setupTimeFiltersFromConfiguration();
        this.registerFilterEvents();
    }

    /**
     * Resets all filters to their default values.
     */
    public reset() {
        this.keywordFilters = [];
        this.disabledLogLevels = [];
        this.sessionId = null;
        this.timeFilterFrom = this.minimumDate;
        this.timeFilterTill = null;
        this.postMessageService.sendAndForget({ command: "updateNumberOfActiveFilters", data: 0 });
    }

    /**
     * Sets up the keyword filters from the configuration.
     */
    private setupKeywordFiltersFromConfiguration() {
        this.keywordFilters = this.configurationManager.keywordFilters.filter(kw => kw.isChecked).map(kw => kw.keyword);
        this.logger.info("setupKeywordFiltersFromConfiguration");
        this.postMessageService.sendAndForget({ command: "updateNumberOfActiveFilters", data: this.getNumberOfActiveFilters() });
        this.postMessageService.sendAndForget({
            command: "setKeywordFiltersFromConfiguration",
            data: this.configurationManager.keywordFilters.map(kw => ({ value: kw.keyword, isChecked: kw.isChecked })),
        });
    }

    /**
     * Sets up the log level filters from the configuration.
     */
    private setupLogLevelFiltersFromConfiguration() {
        this.logger.info("setupLogLevelFiltersFromConfiguration");

        this.disabledLogLevels = this.configurationManager.disabledLogLevels;

        this.postMessageService.sendAndForget({ command: "updateNumberOfActiveFilters", data: this.getNumberOfActiveFilters() });
        this.postMessageService.sendAndForget({
            command: "setLogLevelFromConfiguration",
            data: this.disabledLogLevels,
        });
    }

    /**
     * Sets up the time filters from the configuration.
     */
    private setupTimeFiltersFromConfiguration() {
        this.logger.info("setupTimeFiltersFromConfiguration");

        if (this.configurationManager.enabledTimeFilters.fromDate !== undefined) {
            this.logger.info("setupTimeFiltersFromConfiguration.fromDate", undefined, {
                fromDate: this.configurationManager.enabledTimeFilters.fromDate?.toString(),
            });
            this.timeFilterFrom = this.configurationManager.enabledTimeFilters.fromDate;
        }

        if (this.configurationManager.enabledTimeFilters.tillDate !== undefined) {
            this.logger.info("setupTimeFiltersFromConfiguration.tillDate", undefined, {
                tillDate: this.configurationManager.enabledTimeFilters.tillDate?.toString(),
            });
            this.timeFilterTill = this.configurationManager.enabledTimeFilters.tillDate;
        }
    }

    /**
     * Tries to find a log entry that contains the session id and returns the entry.
     * There might be multiple log entries with the same session id, but we need to find the earliest one.
     * @returns The first log entry that contains the session id.
     */
    private findEarliestSessionIdInLogEntries(): LogEntry | null {
        if (!this.sessionId) {
            return null;
        }

        let foundEntry: LogEntry | null = null;
        for (const logEntry of this.getLogEntries()) {
            if (logEntry.text.includes(this.sessionId)) {
                // make sure it's not the summary.txt file
                if (logEntry.service === "summary") {
                    this.logger.info("findEarliestSessionIdInLogEntries.foundInSummary", undefined, { sessionId: this.sessionId });
                    continue;
                }

                // make sure the entry has a timestamp (not the epoch date)
                if (logEntry.date.getTime() === EPOCH_DATE.getTime()) {
                    this.logger.info(
                        "findEarliestSessionIdInLogEntries.noDate",
                        `Found log entry with session id: ${logEntry.text} but it has no timestamp.`,
                        { sessionId: this.sessionId }
                    );
                    continue;
                }

                if (!foundEntry) {
                    this.logger.info("findEarliestSessionIdInLogEntries.foundFirst", undefined, {
                        sessionId: this.sessionId,
                        service: logEntry.service,
                    });
                    foundEntry = logEntry;
                } else {
                    // if we found another log entry with the same session id, check if it's earlier
                    if (logEntry.date.getTime() < foundEntry.date.getTime()) {
                        this.logger.info("findEarliestSessionIdInLogEntries.foundEarlier", undefined, {
                            sessionId: this.sessionId,
                            service: logEntry.service,
                        });
                        foundEntry = logEntry;
                    } else {
                        this.logger.info("findEarliestSessionIdInLogEntries.foundLater", undefined, {
                            sessionId: this.sessionId,
                            service: logEntry.service,
                        });
                    }
                }
            }
        }

        return foundEntry;
    }

    /**
     * Registers the filter events for the log content provider.
     * This method is called in the constructor.
     *
     * Events are called when the user changes a filter through the webview.
     * They are dispatched by the {@link ExtensionPostMessageService}.
     */
    private registerFilterEvents() {
        const filterCheckboxStateChange = this.postMessageService.registerMessageHandler("filterCheckboxStateChange", (event, respond) => {
            if (event.isChecked) {
                this.keywordFilters.push(event.value);
            } else {
                this.keywordFilters = this.keywordFilters.filter(keyword => keyword !== event.value);
            }
            this.filterMessagesToRespondTo.push(respond);
            this.triggerDocumentChange();
        });
        this.unregisterListeners.push(filterCheckboxStateChange);

        const filterLogLevel = this.postMessageService.registerMessageHandler("filterLogLevel", (event, respond) => {
            if (event.isChecked) {
                this.disabledLogLevels = this.disabledLogLevels.filter(level => level !== event.logLevel);
            } else {
                if (!this.disabledLogLevels.includes(event.logLevel)) {
                    this.disabledLogLevels.push(event.logLevel);
                }
            }
            this.filterMessagesToRespondTo.push(respond);
            this.triggerDocumentChange();
        });
        this.unregisterListeners.push(filterLogLevel);

        const filterTime = this.postMessageService.registerMessageHandler("filterTime", (event, respond) => {
            if (event.fromDate || event.fromDate === "") {
                if (event.fromDate === "") {
                    this.timeFilterFrom = this.minimumDate;
                } else {
                    this.timeFilterFrom = event.fromDate;
                }
            }

            if (event.tillDate || event.tillDate === "") {
                this.timeFilterTill = event.tillDate;
            }
            this.filterMessagesToRespondTo.push(respond);
            this.triggerDocumentChange();
        });
        this.unregisterListeners.push(filterTime);

        const filterRemoveEntriesWithNoEventTime = this.postMessageService.registerMessageHandler("filterNoEventTime", (event, respond) => {
            if (event.removeEntriesWithNoEventTime === true) {
                this.minimumDate = new Date(1000).toISOString();
                this.timeFilterFrom = this.minimumDate;
            } else if (event.removeEntriesWithNoEventTime === false) {
                this.timeFilterFrom = null;
                this.minimumDate = null;
            }
            this.filterMessagesToRespondTo.push(respond);
            this.triggerDocumentChange();
        });
        this.unregisterListeners.push(filterRemoveEntriesWithNoEventTime);

        const filterSessionId = this.postMessageService.registerMessageHandler("filterSessionId", (event, respond) => {
            if (event.isChecked) {
                this.sessionId = event.sessionId;
                const sessionIdLogEntry = this.findEarliestSessionIdInLogEntries();
                if (sessionIdLogEntry) {
                    // subtract 1 second from the timestamp to make sure we include the log entry with the session id
                    const filterFrom = new Date(sessionIdLogEntry.date.getTime() - 1000).toISOString();
                    this.logger.info("filterSessionId.success", undefined, { sessionId: this.sessionId, filterFrom });
                    this.timeFilterFrom = filterFrom;
                } else {
                    this.logger.logException(
                        "filterSessionId.notFound",
                        new Error(`Could not find log entry with session id: ${this.sessionId}`),
                        undefined,
                        {
                            sessionId: this.sessionId,
                        },
                        true,
                        "Session Id"
                    );
                }
            } else {
                this.sessionId = null;
                this.timeFilterFrom = this.minimumDate;
            }
            this.filterMessagesToRespondTo.push(respond);
            this.triggerDocumentChange();
        });
        this.unregisterListeners.push(filterSessionId);

        this.onFilterChangeEvent(event => {
            if (event.fromDate || event.fromDate === "") {
                if (event.fromDate === "") {
                    this.timeFilterFrom = this.minimumDate;
                } else {
                    this.timeFilterFrom = event.fromDate;
                }
            }

            if (event.tillDate || event.tillDate === "") {
                this.timeFilterTill = event.tillDate;
            }

            this.triggerDocumentChange();
        });
    }

    /**
     * Responds to the messages that are waiting for the content to be generated.
     */
    public respondToMessages() {
        const activeFilters = this.getNumberOfActiveFilters();
        // pop all the filter messages and respond to them
        while (this.filterMessagesToRespondTo.length > 0) {
            const respond = this.filterMessagesToRespondTo.pop();
            if (respond) {
                this.logger.info("respondToMessages");
                respond({ command: "updateNumberOfActiveFilters", data: activeFilters });
            }
        }
    }

    /**
     * Calculates the number of filters that are currently active.
     * @returns The number of filters that are currently active.
     */
    public getNumberOfActiveFilters(): number {
        const numberOfKeywordFilters = this.keywordFilters.length;
        const numberOfTimeFilters = (this._timeFilterFrom ? 1 : 0) + (this._timeFilterTill ? 1 : 0);
        const logLevelFilter = this.disabledLogLevels.length;

        return numberOfKeywordFilters + numberOfTimeFilters + logLevelFilter;
    }
}

