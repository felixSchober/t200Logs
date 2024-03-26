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

### 0.4.1

### 0.4.2

### 0.4.3

### 0.4.4

### 0.4.5

### 0.4.6

### 0.4.7

### #{NEW_VERSION}#

#{CHANGES}#


#### 📦 Changes
- Merge pull request #73 from felixSchober/dependabot/npm_and_yarn/typescript-5.4.3
- build(deps-dev): bump the eslint group with 3 updates



#### 📦 Changes
- Merge pull request #69 from felixSchober/dependabot/npm_and_yarn/babel/core-7.24.1
- build(deps-dev): bump typescript from 5.4.2 to 5.4.3



#### 📦 Changes
- Merge pull request #15 from felixSchober/dependabot/npm_and_yarn/eslint-plugin-security-2.1.1
- build(deps-dev): bump @babel/core from 7.24.0 to 7.24.1



#### 📦 Changes
- Merge pull request #68 from felixSchober/releases/v0.4.3
- Bump eslint-plugin-security from 1.7.1 to 2.1.1


#### 🐛 Bug Fixes

- fix: combine jobs into one


#### 📦 Changes



#### 📦 Changes
- fix: Fix changelog generation
- build(deps): bump toshimaru/auto-author-assign from 1.1.0 to 2.1.0


#### 🐛 Bug Fixes

- fix: combine changelog build and version bump into one job.
- fix: fix readme so that newest version comes first


#### 📦 Changes
- feat: add error list


### 0.4.0

#### 🚀 Features

feat: save log level in LogEntry
fix: add prettier to eslint config to format on save
refactor: move /info to /diagnose folder
feat: add new setErrorList command
refactor: run --fix to apply prettier code style
feat: add message to jump to a specific line in the log document
feat: open error messages in browser search
fix: cancel previous timeouts so that multiple changes only produce o…

### 0.3.0

#### 🚀 Features

- Adds the ability to filter files and open them from the UI.

### 0.2.2

#### 🚀 Features

- feat: improve release process
- feat: add workflow that creates a new release branch

#### 🐛 Bug Fixes

- fix: add inline source maps for local builds. Removes source maps for prod builds
- fix: use correct regex to replace codicon font path with correct vscode path
- fix: update readme

### 0.2.1

#### 🧪 Maintenance

- bump gittools version

### 0.2.0

#### 🚀 Features

- Stores the current state of a debugging session in the logs folder so that it can be picked up later (or by somebody else)
- Persists following data:
  - cursor position (will jump back to last known position)
  - disabled log levels
  - enabled keyword filters
  - enabled time filters
  - keyword highlights

### 0.1.19

#### 🚀 Features

- no matching PRs

#### 🐛 Bug Fixes

- no matching PRs

#### 🧪 Maintenance

- no matching changes

#### 📦 Uncategorized

- specify the commit author name in the ci/cd workflow
- use release job
- fix: move tags by force pushing
- BUMP version to 0.1.18
- Merge pull request #38 from felixSchober/fixes/fix-keyword-ack-messages
- fix regeneration of severity highlighting
- fix: update PR template
- fix: cleanup readme
- BUMP version to 0.1.18
- bump gittools version
- BUMP version to 0.1.18
- fix GitVersion to use the right bumping logic
- BUMP version to 0.1.18
- checkout head.ref in bump version workflow job
- BUMP version to 0.1.18
- fix: supply branch name to gitversion
- BUMP version to 0.1.19

### 0.1.18

#### 📦 Uncategorized

- Fix performance issues with large logs
- Improve pipelines and generation of releases

### 0.1.9

- Adds support for HAR files

### 0.1.8

- Performance improvements by asynchronously computing code lenses
- Turning off file names will substitute the file name with the an emoji based on log type (desktop, web)
- General bug fixes

### 0.1.7

- Refactor from native HTML and JS to React
- Ability to add keywords through the settings
- Ability to remove keywords from the UI
- Number of highlights is now correctly displayed

### 0.1.5

- Adds custom keyword highlighting

### 0.1.4

- Automated build and release of the extension

### 0.1.3

- Included internal logger for extension

### 0.0.1

Initial release of extension

### 0.0.1

Initial release of extension
