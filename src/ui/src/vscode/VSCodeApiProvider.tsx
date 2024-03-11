/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";
import { WebviewApi } from "vscode-webview";

import { ExtensionStateManager } from "../service/ExtensionStateManager";
import { PostMessageService } from "../service/PostMessageService";

import { ExtensionState, INITIAL_EXTENSION_STATE } from "./ExtensionState";

export type VSCodeApiContextProps<TState> = {
    /**
     *
     */
    api: WebviewApi<TState>;
    /**
     *
     */
    messageService: PostMessageService<TState>;
    /**
     *
     */
    stateService: ExtensionStateManager<TState>;
};
const createContext = <TState,>() => {
    return React.createContext<VSCodeApiContextProps<TState> | null>(null);
};

export const VSCodeApiContext = createContext<ExtensionState>();

type VSCodeApiProviderProps<TState> = {
    /**
     *
     */
    children: React.ReactNode;

    /**
     * The vscode api to provide to the children.
     */
    api: WebviewApi<TState>;
};

/**
 * A provider for the vscode api.
 * @param props Vscode api provider and children.
 * @returns A wrapper around the vscode api.
 */
export const VSCodeApiProvider = (props: VSCodeApiProviderProps<ExtensionState>) => {
    const { api, children } = props;
    const messageServiceRef = React.useRef<PostMessageService<ExtensionState>>();
    const stateServiceRef = React.useRef<ExtensionStateManager<ExtensionState>>();

    const providerValues: VSCodeApiContextProps<ExtensionState> = React.useMemo(() => {
        let messageService = messageServiceRef.current;
        if (!messageService) {
            messageServiceRef.current = new PostMessageService<ExtensionState>(api);
            messageService = messageServiceRef.current;
        }

        let stateService = stateServiceRef.current;
        if (!stateService) {
            stateServiceRef.current = new ExtensionStateManager<ExtensionState>(api, messageService.getLogger(), INITIAL_EXTENSION_STATE);
            stateService = stateServiceRef.current;
        }
        return {
            api,
            messageService,
            stateService,
        };
    }, [api]);

    return <VSCodeApiContext.Provider value={providerValues}>{children}</VSCodeApiContext.Provider>;
};

