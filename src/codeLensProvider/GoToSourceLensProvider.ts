/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { CancellationToken, CodeLens, CodeLensProvider, Command, Range, TextDocument } from "vscode";

/**
 *
 */
export class GoToSourceLensProvider implements CodeLensProvider {
    /**
     * Compute a list of {@link CodeLens lenses}. This call should return as fast as possible and if
     * computing the commands is expensive implementors should only return code lens objects with the
     * range set and implement {@link CodeLensProvider.resolveCodeLens resolve}.
     *
     * @param document The document in which the command was invoked.
     * @param token A cancellation token.
     * @returns An array of code lenses or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] {
        console.log("provideCodeLenses");
        let topOfDocument = new Range(0, 0, 0, 0);

        let c: Command = {
            command: "extension.addConsoleLog",
            title: "Insert console.log",
        };

        let codeLens = new CodeLens(topOfDocument, c);

        return [codeLens];
    }
}

