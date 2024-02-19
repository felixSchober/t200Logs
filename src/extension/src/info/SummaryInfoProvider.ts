/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as fs from "fs/promises";

import * as vscode from "vscode";

import { GUID_REGEX } from "../constants/regex";
import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { SummaryInfo, SummaryInfoUser } from "@t200logs/common";

/**
 * Matches "SessionId:	18bf77c6-e99f-4d46-95ec-3b43100c3861".
 */
const sessionIdRegex = new RegExp(`SessionId:.(${GUID_REGEX.source})`, "g");

/**
 * Matches "DeviceId:	18bf77c6-e99f-4d46-95ec-3b43100c3861".
 */
const deviceIdRegex = new RegExp(`DeviceId:.(${GUID_REGEX.source})`, "g");

/**
 * HostVersion:	24038.2100.2683.226.
 */
const hostVersionRegex = /HostVersion:\s*(\d+\.\d+\.\d+\.\d+)/g;

/**
 * WebVersion:	50/24020709900.
 */
const webVersionRegex = /WebVersion:\s*(\d+\/\d+)/g;

/**
 * Matches "Language:	en-US".
 */
const languageRegex = /Language:\s*(\w+-\w+)/g;

/**
 * Matches "Ring:	ring0".
 */
const ringRegex = /Ring:\s*(\w+)/g;

/**
 * Regex to capture the user information.
 * E.g. "XXX@XXX.com  FirstName LastName  TId:18bf77c6-e99f-4d46-95ec-3b43100c3861  OId:18bf77c6-e99f-4d46-95ec-3b43100c3861  UserId:18bf77c6-e99f-4d46-95ec-3b43100c3861".
 */
const userRegex = /(\S+@\S+)\s+(\S+)\s+(\S+)\s+TId:([0-9a-f-]+)\s+OId:([0-9a-f-]+)\s+UserId:([0-9a-f-]+)/g;

/**
 * SummaryInfoProvider is a class that provides the ability to get summary information from teh summary.txt file.
 */
export class SummaryInfoProvider {
    private readonly logger: ScopedILogger;

    /**
     * Initializes a new instance of the SummaryInfoProvider class.
     * @param logger The logger.
     */
    constructor(logger: ITelemetryLogger) {
        this.logger = logger.createLoggerScope("SummaryInfoProvider");
    }

    /**
     * Gets the summary information from the summary.txt file.
     * @returns The summary information.
     */
    public async getSummaryInfo(): Promise<SummaryInfo> {
        const summaryFileContent = await this.getSummaryFileContent();
        if (summaryFileContent === "") {
            return {
                sessionId: null,
                deviceId: null,
                hostVersion: null,
                webVersion: null,
                language: null,
                ring: null,
                users: [],
            };
        }

        // reset the regexes
        sessionIdRegex.lastIndex = 0;
        deviceIdRegex.lastIndex = 0;
        hostVersionRegex.lastIndex = 0;
        webVersionRegex.lastIndex = 0;
        languageRegex.lastIndex = 0;
        ringRegex.lastIndex = 0;
        userRegex.lastIndex = 0;

        const sessionId = this.getValueFromContent(sessionIdRegex, summaryFileContent);
        const deviceId = this.getValueFromContent(deviceIdRegex, summaryFileContent);
        const hostVersion = this.getValueFromContent(hostVersionRegex, summaryFileContent);
        const webVersion = this.getValueFromContent(webVersionRegex, summaryFileContent);
        const language = this.getValueFromContent(languageRegex, summaryFileContent);
        const ring = this.getValueFromContent(ringRegex, summaryFileContent);
        const users = this.getUsers(summaryFileContent);

        this.logger.info("getSummaryInfo", "Got summary info", {
            fileContentSubstring: summaryFileContent.substring(0, 100),
            sessionId: sessionId ?? "",
            deviceId: deviceId ?? "",
            hostVersion: hostVersion ?? "",
            webVersion: webVersion ?? "",
            language: language ?? "",
            ring: ring ?? "",
        });

        return {
            sessionId,
            deviceId,
            hostVersion,
            webVersion,
            language,
            ring,
            users,
        };
    }

    /**
     * Gets the summary file content.
     * @returns The summary file content.
     */
    private async getSummaryFileContent(): Promise<string> {
        const fileUris = await vscode.workspace.findFiles("**/summary.txt");
        if (fileUris.length === 0) {
            this.logger.info("getSummaryFileContent.noFile");
            return "";
        } else if (fileUris.length > 1) {
            void this.logger.logException(
                "getSummaryFileContent",
                new Error("Multiple summary files found"),
                "Multiple summary files found",
                { numberOfFiles: "" + fileUris.length }
            );
            return "";
        }

        const fileUri = fileUris[0];
        const fileContent = await fs.readFile(fileUri.fsPath, "utf8");
        if (fileContent.length < 10) {
            this.logger.info("getSummaryFileContent.small", undefined, {
                fileUri: fileUri.fsPath,
                fileContent: fileContent,
            });
        }
        return fileContent;
    }

    /**
     * Gets the value from the content using the given regex.
     * @param regex The regex to use.
     * @param content The content to get the value from.
     * @returns The value from the content.
     */
    private getValueFromContent(regex: RegExp, content: string): string | null {
        const match = regex.exec(content);

        this.logger.info("getValueFromContent", undefined, {
            regex: regex.source,
            content: content.substring(0, 30),
            match0: match?.[0] ?? "-",
            match1: match?.[1] ?? "-",
        });

        return match ? match[1] : null;
    }

    /**
     * Gets the users from the summary file content.
     * @param summaryFileContent The summary file content.
     * @returns The users.
     */
    private getUsers(summaryFileContent: string): SummaryInfoUser[] {
        const users: SummaryInfoUser[] = [];
        let match: RegExpExecArray | null;
        while ((match = userRegex.exec(summaryFileContent)) !== null) {
            users.push({
                upn: match[1],
                name: `${match[2]} ${match[3]}`,
                tenantId: match[4],
                oid: match[5],
                userId: match[6],
            });
        }
        return users;
    }
}

















