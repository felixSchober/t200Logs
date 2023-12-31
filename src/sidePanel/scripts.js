/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

const vscode = acquireVsCodeApi();

// In order to use all the Webview UI Toolkit web components they
// must be registered with the browser (i.e. webview) using the
// syntax below.
provideVSCodeDesignSystem().register(allComponents);

// Just like a regular webpage we need to wait for the webview
// DOM to load before we can reference any of the HTML elements
// or toolkit components
window.addEventListener("load", main);

// document.getElementById("applyFilters")?.addEventListener("click", () => {
//     const timeFilter = document.getElementById("timeFilter")?.value;
//     const keywordFilter = document.getElementById("keywordFilter")?.value;
//     vscode.postMessage({
//         command: "applyFilters",
//         timeFilter: timeFilter,
//         keywordFilter: keywordFilter,
//     });
// });
let hasBeenLoaded = false;
const customFilters = [
    {
        checkboxId: "filter_1_kw",
        keyword: "Auth",
        isChecked: false,
    },
    {
        checkboxId: "filter_2_kw",
        keyword: "[error]",
        isChecked: false,
    },
    {
        checkboxId: "filter_3_kw",
        keyword: "err",
        isChecked: false,
    },
    {
        checkboxId: "filter_4_kw",
        keyword: "[success]",
        isChecked: false,
    },
    {
        checkboxId: "filter_5_kw",
        keyword: "CDL",
        isChecked: false,
    },
    {
        checkboxId: "filter_6_kw",
        keyword: "auth-login-page",
        isChecked: false,
    }
];

// getting messages from extension
window.addEventListener("message", event => {
    const message = event.data;
    debugger;
    console.log("Received message from extension: ", message);
    switch (message.command) {

        case "updateFilters":
            document.getElementById("timeFilter")?.setAttribute("value", message.timeFilter);
            document.getElementById("keywordFilter")?.setAttribute("value", message.keywordFilter);
            break;
        case "updateDataGrid":
            const dataGrid = document.getElementById("default-grid");
            dataGrid.rowsData = message.data;
            break;
        default:
            break;
    }
});

/**
 * Sends a message to the extension when a checkbox state changes.
 * @param checkboxId The id of the checkbox that changed.
 */
function sendCheckboxStateChange(checkboxId) {
    const checkboxElement = document.getElementById(checkboxId);
    const filterDefinition = customFilters.find(filter => filter.checkboxId === checkboxId);

    // update filter definition
    filterDefinition.isChecked = checkboxElement.checked;
    console.log("Sending message to extension: ", filterDefinition);
    debugger;
    vscode.postMessage({
        command: "filterCheckboxStateChange",
        filterDefinition,
    });
}

/**
 * Adds a new checkbox filter to the DOM.
 * @param filter The filter to add.
 * @param addToList Whether to add the filter to the customFilters list.
 */
function addNewCheckboxFilter(filter, addToList = true) {
    console.log("Adding new filter: ", filter);
    const filtersContainer = document.getElementById("filter_custom_kw");
    const checkbox = document.createElement("vscode-checkbox");
    checkbox.id = filter.checkboxId;
    checkbox.label = filter.keyword;
    checkbox.checked = filter.isChecked;
    checkbox.innerText = filter.keyword;

    // adding a listener to the checkbox
    checkbox.addEventListener("change", () => {
        sendCheckboxStateChange(checkbox.id);
    });

    filtersContainer.appendChild(checkbox);

    if (addToList) {
        customFilters.push(filter);
    }

    sendCheckboxStateChange(checkbox.id);
}

/**
 * Main entry point for the webview.
 */
function main() {

    if (hasBeenLoaded) {
        return;
    }
    hasBeenLoaded = true;

    // add custom filters
    for (const filter of customFilters) {
        debugger;
        // adding a checkbox to the DOM
        addNewCheckboxFilter(filter, false);
    }

    // adding a listener to the "Add Filter" button to add a new filter
    document.getElementById("filter_kw_add_button").addEventListener("click", () => {
        const newFilter = {
            checkboxId: `filter_${customFilters.length + 1}_kw`,
            keyword: document.getElementById("filter_kw_add_input").value,
            isChecked: true,
        };
        addNewCheckboxFilter(newFilter, true);

        // remove the text from the input field
        document.getElementById("filter_kw_add_input").value = "";
    });

    // adding a listener on the filter_kw_add_input input field to update the disabled state of the "Add Filter" button
    document.getElementById("filter_kw_add_input").addEventListener("input", () => {
        const addFilterButton = document.getElementById("filter_kw_add_button");
        const input = document.getElementById("filter_kw_add_input");
        if (input.value.length > 0) {
            addFilterButton.removeAttribute("disabled");
        } else {
            addFilterButton.setAttribute("disabled", "true");
        }
    });

    // adding a listener to the display_filenames checkbox to send a message to the extension
    document.getElementById("display_filenames").addEventListener("change", () => {
        vscode.postMessage({
            command: "displayFilenamesCheckboxStateChange",
            isChecked: document.getElementById("display_filenames").checked,
        });
    });

    // adding a listener to the display_guids checkbox to send a message to the extension
    document.getElementById("display_guids").addEventListener("change", () => {
        vscode.postMessage({
            command: "displayGuidsCheckboxStateChange",
            isChecked: document.getElementById("display_guids").checked,
        });
    });

    // add a "debounced" listener to the timeFilter input field to send a message to the extension when the user stops typing
    const timeFilterInputFrom = document.getElementById("filter_date_from");
    let timeoutFrom = null;
    timeFilterInputFrom.addEventListener("input", () => {
        clearTimeout(timeoutFrom);
        timeoutFrom = setTimeout(() => {
            vscode.postMessage({
                command: "timeFilterInputFromChange",
                timeFilter: timeFilterInputFrom.value,
            });
        }, 500);
    });

    // add a "debounced" listener to the timeFilter input field to send a message to the extension when the user stops typing
    const timeFilterInputTill = document.getElementById("filter_date_till");
    let timeoutTo = null;
    timeFilterInputTill.addEventListener("input", () => {
        clearTimeout(timeoutTo);
        timeoutTo = setTimeout(() => {
            vscode.postMessage({
                command: "timeFilterInputTillChange",
                timeFilter: timeFilterInputTill.value,
            });
        }, 500);
    });


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
