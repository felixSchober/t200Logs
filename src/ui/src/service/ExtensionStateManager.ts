import { WebviewApi } from "vscode-webview";
import { ILogger } from "./ILogger";

export class ExtensionStateManager<T> {
    constructor(
        private readonly api: WebviewApi<T>,
        private readonly logger: ILogger,
        private readonly initialState: T
    ) {
        this.api = api;
    }

    public getState(): T {
        const state = this.api.getState();
        if (!state) {
            this.logger.log("ExtensionStateManager.getState", "Getting initial state from vscode api");
            return this.initialState;
        }
        return state;
    }

    public getStateForKey<K extends keyof T>(key: K): T[K] {
        this.logger.log("ExtensionStateManager.getStateForKey", `Getting state for key ${String(key)} from vscode api`);
        const state = this.getState();
        return state[key];
    }

    public setState(state: T): void {
        this.api.setState(state);
    }

    public setStateForKey<K extends keyof T>(key: K, value: T[K]): void {
        this.logger.log("ExtensionStateManager.setStateForKey", `Setting state for key ${String(key)} in vscode api`);
        const state = this.getState();
        state[key] = value;
        this.setState(state);
    }
}


