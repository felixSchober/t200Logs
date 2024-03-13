/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { ALL_LOG_LEVELS, KeywordHighlightSchema, LogLevelSchema, MessageSchemaMap } from "@t200logs/common";
import { z } from "zod";

/**
 * The valid versions of the project configuration schema.
 */
const ValidVersionSchema = z.union([z.literal("1.0.0"), z.literal("1.0.1")]);

/**
 * The valid versions that a project configuration can be.
 */
export type ValidProjectConfigurationVersion = z.TypeOf<typeof ValidVersionSchema>;

/**
 * This is the sub part of a project configuration that just contains the version number.
 * This can be used to extract just the version number from a project configuration so that the right schema can be used to validate the rest of the configuration.
 */
export const ProjectConfigurationSchemaVersion = z.object({
    /**
     * The version of the configuration schema.
     */
    version: ValidVersionSchema,
});

/**
 * DUMMY 1.0.0 schema. This is a placeholder for the actual schema.
 */
const ProjectConfigurationSchema100 = z.object({
    /**
     * The version of the configuration schema.
     */
    version: z.literal("1.0.0"),

    /**
     * The current cursor position in the log file.
     */
    cursorPosition: z.number(),

    /**
     * The log levels that are enabled.
     */
    enabledLogLevels: z.array(LogLevelSchema),

    /**
     * The keyword filters that are enabled for the project.
     */
    enabledKeywordFilters: z.array(z.string()),

    /**
     * The time filters that are enabled for the project.
     */
    enabledTimeFilters: MessageSchemaMap.filterTime,

    /**
     * The keyword highlights that are enabled for the project.
     */
    enabledKeywordHighlights: z.array(KeywordHighlightSchema),
});;

/**
 * The current schema for the project configuration stored within the workspace as a json file.
 */
const ProjectConfigurationSchema = z.object({
    /**
     * The version of the configuration schema.
     */
    version: z.literal("1.0.1"),

    /**
     * The current cursor position in the log file.
     */
    cursorPosition: z.number(),

    /**
     * The log levels that are disabled.
     */
    disabledLogLevels: z.array(LogLevelSchema),

    /**
     * The keyword filters that are enabled for the project.
     */
    enabledKeywordFilters: z.array(z.string()),

    /**
     * The time filters that are enabled for the project.
     */
    enabledTimeFilters: MessageSchemaMap.filterTime,

    /**
     * The keyword highlights that are enabled for the project.
     */
    enabledKeywordHighlights: z.array(KeywordHighlightSchema),
});

/**
 * Iterates over all the schema versions and creates a map of the schema version to the schema.
 */
type AllSchemas = {[version in ValidProjectConfigurationVersion]: z.Schema};

/**
 * The map of all the project configuration schemas.
 */
export const ProjectConfigurationSchemas: AllSchemas = {
    "1.0.0": ProjectConfigurationSchema100,
    "1.0.1": ProjectConfigurationSchema,
};
/**
 * The current schema for the project configuration stored within the workspace as a json file.
 * When a new version of the schema is added, the version number should be updated and a new schema should be added to the `ProjectConfigurationSchemas` object.
 */
const CurrentProjectConfigurationSchema = ProjectConfigurationSchema;

/**
 * The type representing the current {@link ProjectConfigurationSchema}.
 */
export type ProjectConfiguration = z.TypeOf<typeof CurrentProjectConfigurationSchema>;

export const emptyProjectConfiguration: ProjectConfiguration = {
    version: "1.0.1",
        cursorPosition: 0,
        disabledLogLevels: [],
        enabledKeywordFilters: [],
        enabledTimeFilters: {
            fromDate: null,
            tillDate: null,
        },
        enabledKeywordHighlights: [],
    };

/**
 * Dummy upgrades from 1.0.0 to the latest version.
 * @param old The old version of the project configuration.
 * @returns The new version of the project configuration.
 */
const upgradeFrom100 = (old: z.infer<typeof ProjectConfigurationSchema100>): ProjectConfiguration => {
    const disabledLogLevels = ALL_LOG_LEVELS.filter(l => !old.enabledLogLevels.includes(l));
    return {
        ...old,
        version: "1.0.1",
        disabledLogLevels
    };
};

/**
 * Gets the most recent version of the project configuration.
 * 
 * In case the version is not the most recent, the configuration will be upgraded to the most recent version.
 * This function will throw an error if parsing is not possible.
 * @param oldVersion The old version of the project configuration.
 * @param jsonContent The content of the project configuration file.
 * @returns Returns a tuple of the most recent project configuration and a boolean indicating if the configuration was upgraded.
 */
export const getMostRecentConfiguration = (oldVersion: ValidProjectConfigurationVersion, jsonContent: unknown): [ProjectConfiguration, boolean] => {
    const OldVersionSchema = ProjectConfigurationSchemas[oldVersion];
    switch (oldVersion) {
        case "1.0.0":
            return [upgradeFrom100(OldVersionSchema.parse(jsonContent)), true];
        default:
            return [CurrentProjectConfigurationSchema.parse(jsonContent), false];
    }
};