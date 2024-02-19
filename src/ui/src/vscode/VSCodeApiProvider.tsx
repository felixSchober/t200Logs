import * as React from "react";
import { WebviewApi } from "vscode-webview";
import { PostMessageService } from "../service/PostMessageService";

export type VSCodeApiContextProps<TState> = {
    api: WebviewApi<TState>;
    messageService: PostMessageService<TState>;
};

export type ExtensionWebviewState = unknown;

const createContext = <TState,>() => {
    return React.createContext<VSCodeApiContextProps<TState> | null>(null);
};

export const VSCodeApiContext = createContext<ExtensionWebviewState>();

type VSCodeApiProviderProps<TState> = {
    children: React.ReactNode;
    api: WebviewApi<TState>;
};

/**
 * A provider for the vscode api
 * @param param0 Vscode api provider and children
 * @returns A wrapper around the vscode api
 */
export const VSCodeApiProvider = <TState,>(props: VSCodeApiProviderProps<TState>) => {
    const { api, children } = props;
    const messageServiceRef = React.useRef<PostMessageService<TState>>();

    const providerValues: VSCodeApiContextProps<TState> = React.useMemo(() => {
        let messageService = messageServiceRef.current;
        if (!messageService) {
            messageServiceRef.current = new PostMessageService<TState>(api);
            messageService = messageServiceRef.current;
        }
        return {
            api,
            messageService,
        };
    }, [api]);

    return <VSCodeApiContext.Provider value={providerValues}>{children}</VSCodeApiContext.Provider>;
};

