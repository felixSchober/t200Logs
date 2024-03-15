/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { GUID_REGEX } from "../../constants/regex";

// eslint-disable-next-line no-useless-escape
const JSON_REGEX = /[{\[]{1}([,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]|".*?")+[}\]]{1}/g;

// - errorCode: string
// - reason: string
// - Description: string
// - ErrorCode: string - OAuth error
// - Message: string - OAuth error
// - SubStatus: string - OAuth error
// - SystemErrorCode: string - OAuth error
// - Tag: string - OAuth error
const PROPERTY_SEARCH_TERMS = {
    errorCode: "", // use as is
    reason: "", // use as is
    description: "", // use as is
    errorcode: "", // use as is
    message: "", // use as is
    substatus: "OneAuth subStatus", // OneAuth error (e.g. 6201)
    systemerrorcode: "systemErrorCode", // OneAuth error (e.g. 0)
    tag: "", // OneAuth tag - can be used as is (e.g. "52trf")
} as const;

const PROPERTY_SEARCH_TERMS_VALUES = Object.keys(PROPERTY_SEARCH_TERMS);

/**
 * Service to diagnose messages and extract data from them.
 */
export class MessageDiagnoseService {
    /**
     * Try to extract data from a message by parsing JSON and extracting the data.
     * @param message The message to extract data from.
     * @returns A list of strings that can be searched for.
     *
     * @example
     * const message = "Error: {\"errorCode\": \"123\", \"reason\": \"Something went wrong\"}";
     * const data = MessageDiagnoseService.tryExtractDataFromMessage(message);
     * // data = ["123", "Something went wrong"]
     */
    public static tryExtractDataFromMessage(message: string): string[] {
        // try to find JSON in the message
        JSON_REGEX.lastIndex = 0;
        const matches = message.match(JSON_REGEX);
        const objects: unknown[] = [];
        if (matches && matches.length > 0) {
            const data = matches[0];
            try {
                const parsedData = JSON.parse(data);
                objects.push(parsedData);
            } catch (e) {
                // not valid JSON - ignore
            }
        }

        const searchTerms = this.analyzeJsonObjects(objects);
        if (searchTerms.length > 0) {
            return searchTerms;
        }

        const errorLogLevelRegex = /.*ERROR\s|.*\sErr\s|.*<ERR>\s|\[failure\]|Error/g;
        message = message.replace(errorLogLevelRegex, "");

        // replace guids
        GUID_REGEX.lastIndex = 0;
        message = message.replaceAll(GUID_REGEX, "");
        return [message];
    }

    /**
     * Analyze JSON objects and extract interesting data from them.
     * @param objects The JSON objects to analyze.
     * @returns A list of strings that can be searched for.
     */
    private static analyzeJsonObjects(objects: unknown[]): string[] {
        const interestingData: string[] = [];

        for (const obj of objects) {
            if (obj && typeof obj === "object") {
                Object.keys(obj).forEach(key => {
                    if (PROPERTY_SEARCH_TERMS_VALUES.includes(key.toLowerCase())) {
                        interestingData.push(
                            this.getSearchTerm(key.toLowerCase() as keyof typeof PROPERTY_SEARCH_TERMS, obj[key as keyof typeof obj])
                        );
                    }
                });
            }
        }
        return interestingData;
    }

    /**
     * Get a search term for a property and value.
     * @param property The property to search for.
     * @param value The value to search for.
     * @returns The search term.
     */
    private static getSearchTerm(property: keyof typeof PROPERTY_SEARCH_TERMS, value: string): string {
        return `${PROPERTY_SEARCH_TERMS[property]} ${value}`;
    }
}
