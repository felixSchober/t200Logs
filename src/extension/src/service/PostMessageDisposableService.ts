/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { Disposable } from "vscode";

/**
 * Abstract class for services that listen to post messages and need to unregister the listeners when disposed.
 */
export abstract class PostMessageDisposableService implements Disposable {
    

    /**
     * List of functions which will unregister the listeners.
     */
    protected readonly unregisterListeners: (() => void)[] = [];


    /**
     * Disposes of the object by unregistering all listeners.
     */
    dispose() {
         // pop all the handler registrations
         while (this.unregisterListeners.length > 0) {
            const handler = this.unregisterListeners.pop();
            if (handler) {
                handler();
            }
        }
    }
}