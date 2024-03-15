/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { IPostMessageService } from "@t200logs/common";
import * as vscode from "vscode";

import { ScopedILogger } from "../telemetry/ILogger";
import { ITelemetryLogger } from "../telemetry/ITelemetryLogger";

import { PostMessageDisposableService } from "./PostMessageDisposableService";

/**
 * A service for interacting with the browser window.
 */
export class BrowserWindowService extends PostMessageDisposableService {
    private readonly logger: ScopedILogger;

    /**
     * Creates a new instance of the BrowserWindowService class.
     * @param postMessageService The post message service to use.
     * @param logger The logger to use.
     */
    constructor(postMessageService: IPostMessageService, logger: ITelemetryLogger) {
        super();
        this.logger = logger.createLoggerScope("BrowserWindowService");

        // TODO register new openSearchWindows handler
        // use the following command to open a new search window
        // vscode.env.openExternal(Uri.parse("https://www.stackoverflow.com/"));

        const unregisterListener = postMessageService.registerMessageHandler("openSearchWindows", (searchParameters, respond) => {
            this.logger.info("openSearchWindows", undefined, { searchParameters: searchParameters.join(",") });
            void vscode.env.openExternal(this.getADOSearchUrl(searchParameters));
            respond({ command: "messageAck", data: undefined });
        });
        this.unregisterListeners.push(unregisterListener);
    }

    /**
     * Returns the URL for the ADO search.
     * @param searchParameters The search parameters.
     * @returns The URL for the ADO search.
     */
    private getADOSearchUrl(searchParameters: string[]): vscode.Uri {
        return vscode.Uri.parse(`https://domoreexp.visualstudio.com/MSTeams/_search?text=${searchParameters.join("+")}&type=workitem`);
    }
}
