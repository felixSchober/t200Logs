/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";
import * as ReactDOM from "react-dom/client";

import { App } from "./App";

const container = document.getElementById("root") as HTMLElement;

const startApp = () => {
    return ReactDOM.createRoot(container).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
};

startApp();
