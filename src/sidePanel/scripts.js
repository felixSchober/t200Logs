/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

const vscode = acquireVsCodeApi();

debugger;

// In order to use all the Webview UI Toolkit web components they
// must be registered with the browser (i.e. webview) using the
// syntax below.
provideVSCodeDesignSystem().register(allComponents);

// Just like a regular webpage we need to wait for the webview
// DOM to load before we can reference any of the HTML elements
// or toolkit components
window.addEventListener("load", main);

document.getElementById("applyFilters")?.addEventListener("click", () => {
    const timeFilter = document.getElementById("timeFilter")?.value;
    const keywordFilter = document.getElementById("keywordFilter")?.value;
    vscode.postMessage({
        command: "applyFilters",
        timeFilter: timeFilter,
        keywordFilter: keywordFilter,
    });
});

/**
 * Main entry point for the webview.
 */
function main() {
    // Set checkbox indeterminate state
    const checkbox = document.getElementById("basic-checkbox");
    checkbox.indeterminate = true;

    // Define default data grid
    const defaultDataGrid = document.getElementById("default-grid");
    defaultDataGrid.rowsData = [
        {
            column1: "Cell Data",
            column2: "Cell Data",
            column3: "Cell Data",
            column4: "Cell Data",
        },
        {
            column1: "Cell Data",
            column2: "Cell Data",
            column3: "Cell Data",
            column4: "Cell Data",
        },
        {
            column1: "Cell Data",
            column2: "Cell Data",
            column3: "Cell Data",
            column4: "Cell Data",
        },
    ];

    // Define data grid with custom titles
    const basicDataGridList = document.querySelectorAll(".basic-grid");
    basicDataGridList.forEach(basicDataGrid => {
        basicDataGrid.rowsData = [
            {
                columnKey1: "Cell Data",
                columnKey2: "Cell Data",
                columnKey3: "Cell Data",
                columnKey4: "Cell Data",
            },
            {
                columnKey1: "Cell Data",
                columnKey2: "Cell Data",
                columnKey3: "Cell Data",
                columnKey4: "Cell Data",
            },
            {
                columnKey1: "Cell Data",
                columnKey2: "Cell Data",
                columnKey3: "Cell Data",
                columnKey4: "Cell Data",
            },
        ];
        basicDataGrid.columnDefinitions = [
            { columnDataKey: "columnKey1", title: "A Custom Header Title" },
            { columnDataKey: "columnKey2", title: "Custom Title" },
            { columnDataKey: "columnKey3", title: "Title Is Custom" },
            { columnDataKey: "columnKey4", title: "Another Custom Title" },
        ];
    });
}

console.log("Side panel scripts loaded");

