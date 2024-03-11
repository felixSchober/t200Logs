# Teams Logs Parser Extension

This extension is used to parse the logs from the Teams application and display the logs in a readable format.

## Features

Teams logs have potentially hundreds of files and it is hard to find the logs that are relevant to the issue. This extension will help to parse the logs and display the logs in a readable format.

1. Combines the logs from multiple files and displays the logs in a single file and sorts the logs based on the timestamp.
2. Groups the logs based on the time with folding support.
3. Supports keyword search to filter the logs based on the keyword.
4. Supports filtering the logs based on the time range.
5. Supports filtering the logs based on the log level.
6. Highlights the logs based on the log level.
7. Converts ISO dates to human readable format.
8. Quick date filtering through code lens.
9. Extracts session id from the summary and allows filtering based on the session id.

## Interesting keywords

This section collects a list of interesting keywords I need to investigate if they'd be useful to add to the extension as default keywords.
They could also be used in the future to extract more information from the logs into the summary tab.

- `Me::accounts`
- `useUserLicense: userLicenseDetails:`

## Known Issues

- Visual highlights might not be accurate when the log filter has changed.

## Release Notes

See below for a list of release notes

### 0.0.1

Initial release of extension

### 0.1.3

Included internal logger for extension

### 0.1.4

Automated build and release of the extension

### 0.1.5

- Adds custom keyword highlighting

### 0.1.7

- Refactor from native HTML and JS to React
- Ability to add keywords through the settings
- Ability to remove keywords from the UI
- Number of highlights is now correctly displayed

### 0.1.8

- Performance improvements by asynchronously computing code lenses
- Turning off file names will substitute the file name with the an emoji based on log type (desktop, web)
- General bug fixes

### 0.1.9

- Adds support for HAR files

### 0.1.18

## 📦 Uncategorized

- Fix performance issues with large logs
- Improve pipelines and generation of releases

### 0.1.18

### - no changes

### 0.1.18

- no changes

### #{NEW_VERSION}#

#{CHANGES}#
