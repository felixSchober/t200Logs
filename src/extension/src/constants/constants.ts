/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/**
 * The extension id.
 * T200 is a play on the T1000 from the Terminator franchise often used in Teams development. However, instead of T1000 it is T200 because it's mainly made for Teams T2.1 and T2.2.
 */
export const EXTENSION_ID = "t200logs";

/**
 * The name of the configuration setting that contains the keywords to filter logs by.
 */
export const KEYWORD_FILTER_CONFIGURATION_SETTING_NAME = "keywords.filter";

/**
 * The name of the configuration setting that contains the keywords to highlight in logs.
 */
export const KEYWORD_HIGHLIGHT_CONFIGURATION_SETTING_NAME = "keywords.highlights";

/**
 * The name of the configuration setting that contains the state of the welcome message.
 */
export const WELCOME_MESSAGE_CONFIGURATION_SETTING_NAME = "showWelcomeMessage";

/**
 * The date of the epoch. Used for filtering out log entries that do not have a timestamp.
 */
export const EPOCH_DATE = new Date(0);

/**
 * The maximum number of log files to return for a service.
 */
export const MAX_LOG_FILES_PER_SERVICE = 3;
