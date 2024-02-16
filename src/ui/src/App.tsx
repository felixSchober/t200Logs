/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as React from "react";

export const App: React.FC = () => {

    const [counter, setCounter] = React.useState(0);
    const increment = () => setCounter(counter + 1);
    return (
        <div>
          <h1>Hello, React!</h1>
            <p>Counter: {counter}</p>
          <button onClick={increment}>Increment</button>
        </div>
      )
};