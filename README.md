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

#### 📦 Uncategorized

- Fix performance issues with large logs
- Improve pipelines and generation of releases

### 0.1.18

- Fix severity highlight application

### 0.1.19

#### 🚀 Features

- improve release process

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

### 0.2.0

#### 🚀 Features

- Stores the current state of a debugging session in the logs folder so that it can be picked up later (or by somebody else)
- Persists following data:
  - cursor position (will jump back to last known position)
  - disabled log levels
  - enabled keyword filters
  - enabled time filters
  - keyword highlights

### 0.2.1

#### 🧪 Maintenance

- bump gittools version

### 0.2.2


#### 📦 Changes
- specify the commit author name in the ci/cd workflow
- use release job
- fix: move tags by force pushing
- BUMP version to 0.1.18
- Merge pull request #38 from felixSchober/fixes/fix-keyword-ack-messages
- fix regeneration of severity highlighting
- fix: update PR template
- fix: cleanup readme
- bump gittools version
- fix GitVersion to use the right bumping logic
- checkout head.ref in bump version workflow job
- fix: supply branch name to gitversion
- BUMP version to 0.1.19
- Merge pull request #42 from felixSchober/fixes/reapply-severity-highlight
- feat: improve release process
- feat: add worklfow that creates a new release branch
- BUMP version to 0.1.19
- fix: run version bump after build
- fix: remove origin target
- BUMP version to 0.1.19
- fix: print change log and make sure we always post a comment
- update release configuration template
- try new pre alpha
- remove bloat and add uncategorized
- BUMP version to 0.1.19
- fix: removes bump message from PR changelog comment
- fix: use right headings & cleanup readme
- BUMP version to 0.1.19
- Merge pull request #45 from felixSchober/fixes/how-to-release
- Bump the eslint group with 3 updates
- BUMP version to 0.1.19
- fix: use personal PAT to create release branch
- Merge pull request #46 from felixSchober/dependabot/npm_and_yarn/eslint-32f668daad
- fix: Use onInput instead of onChange
- chore: add more workspace extension reccomendations
- fix: turn off no-unused-vars rule and replace by @typescript-eslint/no-unused-vars
- feat: add color picker to keyword highlight page
- feat: add griffel package to ui
- chore: move color picker component to own folder
- fix: downgrade griffel eslint to 1.5.1
- fix: format webpack config
- feat: improve createRandomColor to not create dark colors
- feat: support class names in Flex component
- feat: improve color picker styling
- fix: Readme cleanup
- fix: use public registry
- fix: include from tag for changelog
- BUMP version to 0.2.0
- feat: Add color picker
- feat: update keyword and filter highlight in configuration for extension
- chore: move post message service to /service
- fix: Create abstract helper base that disposes post message listeners
- fix: Add getEditor which only returns the correct editor instead of just the active editor
- feat: send update when checkbox state is changed
- feat: add document location manager to store cursor positon
- feat: store editor state in config file
- fix: make sure tags are force pushed
- ignore: remove debugger statement
- BUMP version to 0.2.0
- feat: Persist the log debugging state between logging sessions
- build(deps): bump gittools/actions from 0.13.2 to 1.1.1
- BUMP version to 0.2.1
- bump gittools/actions from 0.13.2 to 1.1.1
- fix: add inline source maps for local builds. Removes source maps for prod builds
- fix: use correct regex to replace codicon font path with correct vscode path
- fix: update readme
- BUMP version to 0.2.1


### 0.2.2

#### 🚀 Features

- feat: improve release process
- feat: add worklfow that creates a new release branch
- feat: add color picker to keyword highlight page
- feat: add griffel package to ui
- feat: improve createRandomColor to not create dark colors
- feat: support class names in Flex component
- feat: improve color picker styling
- feat: update keyword and filter highlight in configuration for extension
- feat: send update when checkbox state is changed
- feat: add document location manager to store cursor positon
- feat: store editor state in config file

#### 🐛 Bug Fixes

- fix: move tags by force pushing
- fix: update PR template
- fix: cleanup readme
- fix GitVersion to use the right bumping logic
- fix: supply branch name to gitversion
- fix: run version bump after build
- fix: remove origin target
- fix: print change log and make sure we always post a comment
- fix: removes bump message from PR changelog comment
- fix: use right headings & cleanup readme
- fix: format webpack config
- fix: Readme cleanup
- fix: use public registry
- fix: include from tag for changelog
- fix: Create abstract helper base that disposes post message listeners
- fix: Add getEditor which only returns the correct editor instead of just the active editor
- fix: make sure tags are force pushed
- fix: add inline source maps for local builds. Removes source maps for prod builds
- fix: use correct regex to replace codicon font path with correct vscode path
- fix: update readme

#### 🧪 Maintenance

- chore: add more workspace extension reccomendations
- chore: move color picker component to own folder
- chore: move post message service to /service


#### 📦 Changes
- specify the commit author name in the ci/cd workflow
- use release job
- Merge pull request #38 from felixSchober/fixes/fix-keyword-ack-messages
- fix regeneration of severity highlighting
- bump gittools version
- checkout head.ref in bump version workflow job
- Merge pull request #42 from felixSchober/fixes/reapply-severity-highlight
- update release configuration template
- try new pre alpha
- remove bloat and add uncategorized
- Merge pull request #45 from felixSchober/fixes/how-to-release
- Bump the eslint group with 3 updates
- fix: use personal PAT to create release branch
- Merge pull request #46 from felixSchober/dependabot/npm_and_yarn/eslint-32f668daad
- fix: Use onInput instead of onChange
- fix: turn off no-unused-vars rule and replace by @typescript-eslint/no-unused-vars
- fix: downgrade griffel eslint to 1.5.1
- feat: Add color picker
- ignore: remove debugger statement
- feat: Persist the log debugging state between logging sessions
- build(deps): bump gittools/actions from 0.13.2 to 1.1.1
- bump gittools/actions from 0.13.2 to 1.1.1


### 0.2.2

#### 🚀 Features

- feat: improve release process
- feat: add workflow that creates a new release branch

#### 🐛 Bug Fixes

- fix: add inline source maps for local builds. Removes source maps for prod builds
- fix: use correct regex to replace codicon font path with correct vscode path
- fix: update readme


### 0.3.0

- no changes

### 0.4.0

- no changes

### #{NEW_VERSION}#

#{CHANGES}#
