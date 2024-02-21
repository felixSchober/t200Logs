import { ExtensionState, ExtensionStateKey } from "../vscode/ExtensionState";
import { useVSCodeApi } from "../vscode/useVSCodeApi";
import * as React from "react";

type UseExtensionStateHook<T extends ExtensionStateKey> = [ExtensionState[T], React.Dispatch<React.SetStateAction<ExtensionState[T]>>];

/**
 * A hook to get the state for an extension state key
 * @param stateKey The state key to get the state for
 * @returns The state and a function to set the state
 */
export const useExtensionState = <TKey extends ExtensionStateKey>(stateKey: ExtensionStateKey): UseExtensionStateHook<TKey> => {
    const { stateService } = useVSCodeApi();
    const [state, setState] = React.useState<ExtensionState[TKey]>(stateService.getStateForKey(stateKey));

    return React.useMemo(() => {
        return [
            state,
            value => {
                const valueToSet = value instanceof Function ? value(state) : value;

                stateService.setStateForKey(stateKey, valueToSet);
                setState(valueToSet);
            },
        ];
    }, [state, stateService, stateKey]);
};

