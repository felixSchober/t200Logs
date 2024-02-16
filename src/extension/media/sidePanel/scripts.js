/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

"use strict";

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
        checkboxId: "filter_0_kw",
        keyword: "auth_web",
        isChecked: false,
    },
    {
        checkboxId: "filter_1_kw",
        keyword: "Auth|auth",
        isChecked: false,
    },
    {
        checkboxId: "filter_2_kw",
        keyword: "success",
        isChecked: false,
    },
    {
        checkboxId: "filter_3_kw",
        keyword: "CDL|cdl",
        isChecked: false,
    },
    {
        checkboxId: "filter_4_kw",
        keyword: "oneauth|OneAuth",
        isChecked: false,
    },
    {
        checkboxId: "filter_5_kw",
        keyword: "AcquireToken|acquireToken",
        isChecked: false,
    },
    {
        checkboxId: "filter_6_kw",
        keyword: "auth-login-page",
        isChecked: false,
    }
];

const customHighlights = [
    {
        checkboxId: "highlight_0_kw",
        keyword: "auth|Auth",
        isChecked: false,
        color: "#ff0000" // red
    }
];

let summarySessionId = null;

// getting messages from extension
window.addEventListener("message", event => {
    const message = event.data;
    console.log("Received message from extension: ", message);
    switch (message.command) {

        case "timeFilterChange":

            const timeFilterInputFrom = document.getElementById("filter_date_from");
            const timeFilterInputTill = document.getElementById("filter_date_till");

            if (message.timeFilter.fromDate) {
                timeFilterInputFrom.value = message.timeFilter.fromDate;
            }

            if (message.timeFilter.tillDate) {
                timeFilterInputTill.value = message.timeFilter.tillDate;
            }


            break;
        case "updateNumberOfActiveFilters":
            if (message.numberOfActiveFilters === 0) {
                document.getElementById("filter_rules_badge").style.visibility = "hidden";
            } else {
                document.getElementById("filter_rules_badge").style.visibility = "visible";
                document.getElementById("filter_rules_badge").innerText = message.numberOfActiveFilters;
            }
            break;
        case "summaryInfo":
            /**
             * Format of summaryInfo:
             * type SummaryInfo = {
                sessionId: string | null;
                deviceId: string | null;
                hostVersion: string | null;
                webVersion: string | null;
                language: string | null;
                ring: string | null;
                users: {
                    upn: string | null;
                    name: string | null;
                    tenantId: string | null;
                    oid: string | null;
                    userId: string | null;
                }[];
            };.
             */
            const summaryData = message.summaryInfo;
            const rows = [
                {
                    column1: "Session ID",
                    column2: summaryData.sessionId,
                },
                {
                    column1: "Device ID",
                    column2: summaryData.deviceId,
                },
                {
                    column1: "Host Version",
                    column2: summaryData.hostVersion,
                },
                {
                    column1: "Web Version",
                    column2: summaryData.webVersion,
                },
                {
                    column1: "Language",
                    column2: summaryData.language,
                },
                {
                    column1: "Ring",
                    column2: summaryData.ring,
                }
            ];
            summaryData.users?.forEach((user, index) => {
                rows.push({
                    column1: user.upn,
                    column2: user.tenantId,
                });
            });
            document.getElementById("summary-grid").rowsData = rows;


            // enable the checkbox filter_session_id if we have a session id
            if (summaryData.sessionId) {
                document.getElementById("filter_session_id").removeAttribute("disabled");
                summarySessionId = summaryData.sessionId;
            } else {
                document.getElementById("filter_session_id").setAttribute("disabled", "true");
            }
        default:
            break;
    }
});

/**
 * Sends a message to the extension when a checkbox state changes.
 * @param checkboxId The id of the checkbox that changed.
 */
function sendFilterCheckboxStateChange(checkboxId) {
    const checkboxElement = document.getElementById(checkboxId);
    const filterDefinition = customFilters.find(filter => filter.checkboxId === checkboxId);

    // update filter definition
    filterDefinition.isChecked = checkboxElement.checked;
    console.log("Sending message to extension: ", filterDefinition);
    vscode.postMessage({
        command: "filterCheckboxStateChange",
        filterDefinition,
    });
}

/**
 * Sends a message to the extension when a highlight checkbox state changes.
 * @param checkboxId The id of the checkbox that changed.
 */
function sendHighlightCheckboxStateChange(checkboxId) {
    const checkboxElement = document.getElementById(checkboxId);
    const highlight = customHighlights.find(filter => filter.checkboxId === checkboxId);

    // update filter definition
    highlight.isChecked = checkboxElement.checked;
    console.log("Sending message to extension: ", highlight);
    vscode.postMessage({
        command: "keywordHighlightCheckboxStateChange",
        isChecked: highlight.isChecked,
        highlightDefinition: {
            keyword: highlight.keyword,
            color: highlight.color,
        },
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
        sendFilterCheckboxStateChange(checkbox.id);
    });

    filtersContainer.appendChild(checkbox);

    if (addToList) {
        customFilters.push(filter);
    }

    sendFilterCheckboxStateChange(checkbox.id);
}

/**
 * Adds a new keyword highlight to the DOM.
 * @param keyword Adds a new keyword highlight to the DOM.
 * @param addToList Whether to add the filter to the customFilters list.
 */
function addNewKeywordHighlight(keyword, addToList = true) {
    console.log("Adding new highlight: ", keyword);
    const highlightDivContainer = document.getElementById("highlight_custom_kw");

    const checkboxAndColorContainer = document.createElement("div");
    checkboxAndColorContainer.style.display = "flex";
    const checkbox = document.createElement("vscode-checkbox");
    checkbox.id = keyword.checkboxId;
    checkbox.label = keyword.keyword;
    checkbox.checked = keyword.isChecked;
    checkbox.innerText = keyword.keyword;
    checkboxAndColorContainer.appendChild(checkbox);

    const colorPreview = document.createElement("div");
    colorPreview.style.backgroundColor = keyword.color;
    colorPreview.style.width = "20px";
    colorPreview.style.height = "20px";
    colorPreview.style.border = "1px solid black";
    colorPreview.style.marginLeft = "auto";
    checkboxAndColorContainer.appendChild(colorPreview);


    // adding a listener to the checkbox
    checkbox.addEventListener("change", () => {
        sendHighlightCheckboxStateChange(checkbox.id);
    });

    highlightDivContainer.appendChild(checkboxAndColorContainer);

    if (addToList) {
        customHighlights.push({
            checkboxId: checkbox.id,
            keyword: keyword.keyword,
            isChecked: keyword.isChecked,
            color: keyword.color,
        });
    }

    sendHighlightCheckboxStateChange(checkbox.id);
}

const DEFAULT_DEBOUNCE_TIME = 3000;

/**
 * Adds event listeners to the log level checkboxes.
 */
function addLogLevelEventListeners() {
    document.getElementById("filter_error").addEventListener("click", () => {
        vscode.postMessage({
            command: "filterLogLevel",
            logLevel: "error",
            isChecked: document.getElementById("filter_error").checked,
        });
    });

    document.getElementById("filter_warning").addEventListener("click", () => {
        vscode.postMessage({
            command: "filterLogLevel",
            logLevel: "warning",
            isChecked: document.getElementById("filter_warning").checked,
        });
    });

    document.getElementById("filter_info").addEventListener("click", () => {
        vscode.postMessage({
            command: "filterLogLevel",
            logLevel: "info",
            isChecked: document.getElementById("filter_info").checked,
        });
    });

    document.getElementById("filter_debug").addEventListener("click", () => {
        vscode.postMessage({
            command: "filterLogLevel",
            logLevel: "debug",
            isChecked: document.getElementById("filter_debug").checked,
        });
    });
}

/**
 * Adds an event listener to the filter_session_id checkbox.
 */
function addSessionIdFilterCheckboxEventListener() {
    document.getElementById("filter_session_id").addEventListener("click", () => {
        vscode.postMessage({
            command: "filterSessionIdCheckboxStateChange",
            isChecked: document.getElementById("filter_session_id").checked,
            sessionId: summarySessionId,
        });
    });
}

/**
 * Sets up the highlight elements in the DOM.
 */
function setupHighlightElements() {
    // add custom highlights
    for (const highlight of customHighlights) {
        // adding a checkbox to the DOM
        addNewKeywordHighlight(highlight, false);
    }

    // adding a listener to the "Add Highlight" button to add a new highlight
    document.getElementById("highlight_kw_add_button").addEventListener("click", () => {
        const keywordValue = document.getElementById("highlight_kw_add_input").value;

        if (keywordValue.length === 0) {
            return;
        }

        // use the keyword value as a hash to generate a random color

        const randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
        const newHighlight = {
            checkboxId: `highlight_${customHighlights.length + 1}_kw`,
            keyword: keywordValue,
            isChecked: true,
            color: randomColor,
        };
        addNewKeywordHighlight(newHighlight, true);

        // remove the text from the input field
        document.getElementById("highlight_kw_add_input").value = "";
    });

}
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

    setupHighlightElements();
    addLogLevelEventListeners();
    addSessionIdFilterCheckboxEventListener();

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

    // adding a listener to the display_inlineTime checkbox to send a message to the extension
    document.getElementById("display_inlineTime").addEventListener("change", () => {
        vscode.postMessage({
            command: "displayTimeInlineCheckboxStateChange",
            isChecked: document.getElementById("display_inlineTime").checked,
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

    // request the summary info from the extension
    vscode.postMessage({
        command: "getSummaryInfo",
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
