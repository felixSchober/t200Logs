/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/**
 * A regular expression that matches GUIDs.
 */
export const GUID_REGEX = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89ab][0-9a-fA-F]{3}-[0-9a-fA-F]{12})/g;

/**
 * Matches the standard ISO date format found in web logs.
 * This format is considered to be in UTC (Zulu time).
 * Matches `2023-11-29T10:21:49.895Z.`.
 *
 * Includes a negative lookahead to exclude entries with a quote at the end like in a json string.
 * The date is part of the first capture group.
 *
 * Does not match `2023-11-29T10:21:49.895Z"` (to exclude entries with a quote at the end like in a json string).
 * Does not match `2023-11-29T10:21:49.895Z\\"` (to exclude entries with an escaped quote at the end like in a json string).
 */
export const WEB_DATE_REGEX = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)(?!["\\])/;

/**
 * Same as {@link WEB_DATE_REGEX} but with global flag.
 */
export const WEB_DATE_REGEX_GLOBAL = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)(?!["\\])/;

/**
 * Matches all lines that contain either of the following:
 * - ERROR
 * - Err
 * - <ERR>
 * - [failure].
 */
export const ERROR_REGEX = /.*ERROR.*|.*\sErr\s.*|.*<ERR>.*|\[failure\]/;

/**
 * Matches all lines that contain either of the following:
 * - WARN
 * - Warn
 * - War
 * - <WARN>
 * - <WAR>
 * - warning.
 */
export const WARN_REGEX = /.*\sWARN\s.*|.*\sWarn\s.*|.*\sWar\s.*|.*<WARN>.*|\s<WAR>\s|warning/;









