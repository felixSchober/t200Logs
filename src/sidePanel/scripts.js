/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

const vscode = acquireVsCodeApi();

document.getElementById("applyFilters").addEventListener("click", () => {
    const timeFilter = document.getElementById("timeFilter").value;
    const keywordFilter = document.getElementById("keywordFilter").value;
    vscode.postMessage({
        command: "applyFilters",
        timeFilter: timeFilter,
        keywordFilter: keywordFilter
    });
});

console.log("Side panel scripts loaded");