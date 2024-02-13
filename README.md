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

## Known Issues

- Visual highlights might not be accurate when the log filter has changed.

## Release Notes

See below for a list of release notes

### 0.0.1

Initial release of extension

### 0.0.2

Included internal logger for extension

### 0.0.3

Automated build and release of the extension
