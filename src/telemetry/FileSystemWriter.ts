/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as vscode from "vscode";

import * as pckg from "../../package.json";

import { ILogger } from "./ILogger";

/**
 *
 */
export class FileSystemWriter {
    public readonly logFileName = "log.txt";

    /**
     * Header of log file.
     */
    public readonly fileHeader: string;

    /**
     * File system writer is ready to write to the log file.
     */
    public isReady: boolean = false;

    /**
     * The URI for the log file.
     * @returns The URI for the log file.
     */
    public get logFileUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.logUri, this.logFileName);
    }

    /**
     * Common telemetry properties for the logger.
     * @returns The telemetry properties.
     */
    private get telemetryParams(): { [key: string]: string } {
        return {
            fileHeader: this.fileHeader,
            logFileUri: this.logFileUri.path,
        };
    }

    private readonly logFileEncoding = "utf8";

    /**
     * Initialize the FileSystemWriter.
     * @param logger The logger to be used.
     * @param logUri The path to the log folder for the extension.
     */
    constructor(
        private readonly logger: ILogger,
        private readonly logUri: vscode.Uri
    ) {
        this.fileHeader = `Teams Logs Viewer - ${new Date().toISOString()}. VSCode Version: ${vscode.version} - App Name: ${
            vscode.env.appName
        } - App Root: ${vscode.env.appRoot} - Extension version: ${pckg.version}`;
        void this.initializeLogFolder();
    }

    /**
     * Initialize the log folder and create log file.
     */
    private async initializeLogFolder(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.logUri);
            await this.createLogFile();
        } catch (error) {
            await this.logger.logException("FileSystemWriter.createLogFolder", error, "Failed to create log folder");
        }
        this.isReady = true;
        await this.logger.info("FileSystemWriter.createLogFolder.success");
    }

    /**
     * Create log file with a header.
     */
    private async createLogFile(): Promise<void> {
        try {
            await this.writeString(this.fileHeader);
        } catch (error) {
            await this.logger.logException("FileSystemWriter.createLogFile", error, "Failed to create log file", this.telemetryParams);
        }
    }

    /**
     * Append data to the log file.
     * @param line The data to be appended to the log file.
     */
    public async appendLine(line: string): Promise<void> {
        if (!this.isReady) {
            return;
        }

        try {
            const existingData = await this.readFile();
            await this.writeString(`${existingData}\n${line}`);
        } catch (error) {
            // swallow ;/
        }
    }

    /**
     * Reads string contents from the log file.
     * @returns The string contents of the log file.
     */
    private async readFile(): Promise<string> {
        try {
            const readData = await vscode.workspace.fs.readFile(this.logFileUri);
            return Buffer.from(readData).toString(this.logFileEncoding);
        } catch (error) {
            await this.logger.logException("FileSystemWriter.readFile", error, "Failed to read log file", this.telemetryParams);
            throw error;
        }
    }

    /**
     * Writes string contents to the log file.
     * @param data The string contents to be written to the log file.
     */
    private async writeString(data: string): Promise<void> {
        try {
            const writeData = Buffer.from(data, this.logFileEncoding);
            await vscode.workspace.fs.writeFile(this.logFileUri, writeData);
        } catch (error) {
            await this.logger.logException("FileSystemWriter.writeString", error, "Failed to write to log file", this.telemetryParams);
            throw error;
        }
    }
}

