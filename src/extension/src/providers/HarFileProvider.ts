/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as fs from "fs/promises";

import { HarEntry, HarSchema, JwtSchema } from "@t200logs/common";
import { CancellationToken, Uri, workspace } from "vscode";

import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";
import { throwIfCancellation } from "../utils/throwIfCancellation";

import { LogEntry } from "./LogEntry";
/**
 *
 */
export class HarFileProvider {
    private readonly logger: ScopedILogger;

    /**
     * Cache of all converted, unsorted HAR file entries.
     */
    private harEntryCache: Array<LogEntry> = [];

    /**
     * Creates a new instance of the HarFileProvider.
     * @param logger The logger to use for logging.
     */
    constructor(logger: ITelemetryLogger) {
        this.logger = logger.createLoggerScope("HarFileProvider");
    }

    /**
     * Clears the cache of all HAR file entries.
     */
    public clearCache() {
        this.logger.info("clearCache", undefined, { entries: "" + this.harEntryCache.length });
        this.harEntryCache = [];
    }

    /**
     * Gets all HAR file entries sorted by the time they were sent.
     * @param token The cancellation token to cancel the request.
     * @returns A promise of an array of entries.
     */
    public async getEntries(token: CancellationToken): Promise<Array<LogEntry>> {
        this.logger.info("getEntries.start");
        token.onCancellationRequested(() => {
            this.logger.info("getEntries.cancelled");
        });

        if (this.harEntryCache.length > 0) {
            this.logger.info("getEntries.cache", undefined, { entries: "" + this.harEntryCache.length });
            return this.harEntryCache;
        }

        throwIfCancellation(token);
        const harFiles = await workspace.findFiles("**/*.har", "**/node_modules/**", 5, token);
        this.logger.info("getEntries.findFiles", undefined, { number: "" + harFiles.length });
        if (harFiles.length === 0) {
            return [];
        }

        throwIfCancellation(token);
        const getEntryPromises = harFiles.map(fileUri => this.getEntriesForFile(fileUri, token));
        const entries = (await Promise.all(getEntryPromises)).flat();

        throwIfCancellation(token);
        this.logger.info("getEntries.convert");
        this.harEntryCache = entries.map(entry => this.convertHarEntryToLogEntry(entry));

        this.logger.info("getEntries.end", undefined, { entries: "" + this.harEntryCache.length });
        return this.harEntryCache;
    }

    /**
     * Converts a single HAR entry to a log entry.
     * @param entry The entry to convert.
     * @returns The converted log entry.
     */
    private convertHarEntryToLogEntry(entry: HarEntry): LogEntry {
        return {
            date: new Date(entry.startedDateTime),
            text: this.harEntryToString(entry),
            service: "HAR",
        };
    }

    /**
     * Converts a single {@link HarEntry|HAR entry} to a string used in a {@LogEntry|log entry}.
     * @param entry The entry to convert.
     * @returns The converted log entry.
     * @example "<INFO> [GET] https://www.example.com -> [200 OK]"
     * @example "<WARN> [GET] https://www.example.com -> [404 Not Found] - Not found"
     */
    private harEntryToString(entry: HarEntry): string {
        const logLevel = this.harEntryToLogLevel(entry);

        // include body if warning or error
        let body = "";
        if (logLevel === "<WARN>" || logLevel === "<ERR>") {
            body = ` - ${entry.response.content.text}`;
        }

        return `${logLevel} [${entry.request.method}] ${entry.request.url}${this.getAuthorizationDetails(entry)} -> [${entry.response.status} ${entry.response.statusText}]${body}`;
    }

    /**
     * Converts a single HAR entry to a log level.
     * @param entry The entry to convert.
     * @returns A log level based on the status of the entry.
     */
    private harEntryToLogLevel(entry: HarEntry): "<DBG>" | "<INFO>" | "<WARN>" | "<ERR>" {
        if (entry.request.url.endsWith(".css") || entry.request.url.endsWith(".js")) {
            return "<DBG>";
        }

        const status = entry.response.status;
        if (status < 400) {
            return "<INFO>";
        }
        if (status < 500) {
            return "<WARN>";
        }
        return "<ERR>";
    }

    /**
     * Gets all entries for a single HAR file.
     * @param fileUri The URI to the file.
     * @param token The cancellation token to cancel the request.
     * @returns A promise of an array of {@link HarEntry|entries}.
     */
    private async getEntriesForFile(fileUri: Uri, token: CancellationToken): Promise<Array<HarEntry>> {
        this.logger.info("getEntriesForFile.start", undefined, { file: fileUri.fsPath });
        await this.logHarFileStats(fileUri, token);
        throwIfCancellation(token);
        const content = await fs.readFile(fileUri.fsPath, "utf-8");
        return this.parseStringToEntries(content, token);
    }

    /**
     * Logs the stats of the HAR file to the logger.
     * @param fileUri The URI of the file to lgo.
     * @param token A token to cancel the request.
     */
    private async logHarFileStats(fileUri: Uri, token: CancellationToken): Promise<void> {
        throwIfCancellation(token);
        const stats = await fs.stat(fileUri.fsPath);
        this.logger.info("logHarFileStats", undefined, {
            size: `${stats.size / 1024 / 1024}MB`,
            createdMS: "" + stats.birthtimeMs,
            created: stats.birthtime.toISOString(),
        });
    }

    /**
     * Parses the raw string content into a list of {@link HarEntry|entries}.
     * @param content The content to parse.
     * @param token A token to cancel the request.
     * @returns A list of entries.
     */
    private async parseStringToEntries(content: string, token: CancellationToken): Promise<Array<HarEntry>> {
        if (!content) {
            this.logger.info("parseStringToEntries.noContent");
            return [];
        }
        this.logger.info("parseStringToEntries.start", undefined, { contentLength: "" + content.length });
        throwIfCancellation(token);

        let jsonContent: unknown;
        try {
            jsonContent = JSON.parse(content);
        } catch (error) {
            this.logger.logException(
                "parseStringToEntries.JSON",
                error,
                "Error while parsing HAR file content",
                { contentStart: content.substring(0, 100) },
                true,
                "HAR File"
            );
            return [];
        }

        // try to parse result with zod
        throwIfCancellation(token);
        const parseResult = await HarSchema.safeParseAsync(jsonContent, { async: true });
        if (!parseResult.success) {
            const error = new Error(`Could not verify HAR file content schema. See error: ${parseResult.error.toString()}`);
            this.logger.logException(
                "parseStringToEntries.schema",
                error,
                "Could not verify HAR file content schema. HAR file skipped.",
                { contentStart: content.substring(0, 100) },
                true,
                "HAR File"
            );
            return [];
        }

        this.logger.info("parseStringToEntries.end", undefined, {
            entries: "" + parseResult.data.log.entries.length,
            creator: `${parseResult.data.log.creator.name} - v${parseResult.data.log.creator.version}`,
        });
        return parseResult.data.log.entries;
    }

    /**
     * Gets the authorization details for a single entry.
     * @param entry The entry to get the authorization details for.
     * @returns A string with the authorization details.
     * @example " [🔑 https://www.example.com iat: 1/1/2024 11:42 exp: 2/2/2024 11:42 scp: 'User.ReadAll'] "
     */
    private getAuthorizationDetails(entry: HarEntry): string {
        let result = "";
        const authHeader = entry.request.headers.find(header => header.name.toLowerCase() === "authorization");
        if (!authHeader) {
            return result;
        }
        result += " [🔑";
        const authValue = authHeader.value.replace(/Bearer /, "");

        const tokenParts = authValue.split(".");
        if (tokenParts.length === 3) {
            const decodedPayload = Buffer.from(tokenParts[1], "base64").toString("utf-8");
            if (decodedPayload) {
                let decodedJwtJsonPayload: unknown;
                try {
                    decodedJwtJsonPayload = JSON.parse(decodedPayload);
                } catch (error) {
                    this.logger.logException("getAuthorizationDetails.JSON", error);
                    return `${result}?] `;
                }
                const jwtParseResult = JwtSchema.safeParse(decodedJwtJsonPayload);
                if (jwtParseResult.success) {
                    result += ` ${jwtParseResult.data.aud} iat: ${jwtParseResult.data.iat.toLocaleString()} exp: ${jwtParseResult.data.exp.toLocaleString()} scp: '${jwtParseResult.data.scp ?? ""}'`;
                } else {
                    this.logger.logException("getAuthorizationDetails.schema", jwtParseResult.error);
                    return `${result}?] `;
                }
            }
        }

        // if the token is a JWT, decode it and show the payload

        result += "] ";
        return result;
    }
}


























