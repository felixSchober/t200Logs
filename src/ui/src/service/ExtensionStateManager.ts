/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { WebviewApi } from "vscode-webview";

import { ILogger } from "./ILogger";

/**
 * Manages the state of the extension.
 */
export class ExtensionStateManager<T> {
    /**
     * Creates a new instance of the extension state manager.
     * @param api The webview api.
     * @param logger The logger to use for logging.
     * @param initialState The initial state of the extension.
     */
    constructor(
        private readonly api: WebviewApi<T>,
        private readonly logger: ILogger,
        private readonly initialState: T
    ) {
        this.api = api;
    }

    /**
     * Gets the state of the extension.
     * @returns The state of the extension.
     */
    public getState(): T {
        const state = this.api.getState();
        if (!state) {
            this.logger.log("ExtensionStateManager.getState", "Getting initial state from vscode api");
            return this.initialState;
        }
        return state;
    }

    /**
     * Gets the state of the extension for a specific key.
     * @param key The key to get the state for. The key must be a property of the state type.
     * @returns The state for the key.
     */
    public getStateForKey<K extends keyof T>(key: K): T[K] {
        this.logger.log("ExtensionStateManager.getStateForKey", `Getting state for key ${String(key)} from vscode api`);
        const state = this.getState();
        return state[key];
    }

    /**
     * Sets the state of the extension.
     * @param state The state to set.
     */
    public setState(state: T): void {
        this.api.setState(state);
    }

    /**
     * Sets the state of the extension for a specific key.
     * @param key The key to set the state for. The key must be a property of the state type.
     * @param value  The value to set the state to.
     */
    public setStateForKey<K extends keyof T>(key: K, value: T[K]): void {
        this.logger.log("ExtensionStateManager.setStateForKey", `Setting state for key ${String(key)} in vscode api`);
        const state = this.getState();
        state[key] = value;
        this.setState(state);
    }
}


