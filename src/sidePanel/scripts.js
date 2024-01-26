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
        case "updateNumberOfActiveFilters":
            if (message.numberOfActiveFilters === 0) {
                document.getElementById("filter_rules_badge").style.visibility = "hidden";
            } else {
                document.getElementById("filter_rules_badge").style.visibility = "visible";
                document.getElementById("filter_rules_badge").innerText = message.numberOfActiveFilters;
            }
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
 * Sends a message to the extension to open the logs document.
 */
function openLogsDocument() {
    vscode.postMessage({
        command: "openLogsDocument",
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

const DEFAULT_DEBOUNCE_TIME = 3000;

/**
 * Main entry point for the webview.
 */
function main() {

    // prevent the main function from being called more than once
    if (hasBeenLoaded) {
        return;
    }
    hasBeenLoaded = true;

    // add custom filters
    for (const filter of customFilters) {
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

    // adding a listener to the open_log_document button to send a message to the extension
    document.getElementById("open_log_document").addEventListener("click", () => {
        openLogsDocument();
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

    // adding a listener to the display_visualHints checkbox to send a message to the extension
    document.getElementById("display_visualHints").addEventListener("change", () => {
        vscode.postMessage({
            command: "displayVisualHintsCheckboxStateChange",
            isChecked: document.getElementById("display_visualHints").checked,
        });
    });

    // adding a listener to the display_readableIsoDates checkbox to send a message to the extension
    document.getElementById("display_readableIsoDates").addEventListener("change", () => {
        vscode.postMessage({
            command: "displayReadableIsoDatesCheckboxStateChange",
            isChecked: document.getElementById("display_readableIsoDates").checked,
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
        }, DEFAULT_DEBOUNCE_TIME);
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
        }, DEFAULT_DEBOUNCE_TIME);
    });

    // adding a listener to the filter_no_event_time checkbox to send a message to the extension
    document.getElementById("filter_no_event_time").addEventListener("change", () => {
        vscode.postMessage({
            command: "filterNoEventTimeCheckboxStateChange",
            isChecked: document.getElementById("filter_no_event_time").checked,
        });
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
