import { MessageSchemaMap } from "@t200logs/common";
import { z } from "zod";

export type DisplaySettingState = z.TypeOf<typeof MessageSchemaMap.displaySettingsChanged>;

export type ExtensionState = {
    displaySettingState: DisplaySettingState;
};

export type ExtensionStateKey = keyof ExtensionState;

export const INITIAL_EXTENSION_STATE = {
    displaySettingState: {
        displayFileNames: true,
        displayGuids: true,
        displayLogLevels: false,
        displayReadableDates: false,
        displayDatesInLine: false,
    },
} as const;

