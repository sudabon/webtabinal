## MODIFIED Requirements

### Requirement: Quit when last tab closes in standalone
When `quit_when_no_tabs` is true and the client is running as a desktop window (`matchMedia('(display-mode: standalone)').matches` or the native app WebView), and the sessions list transitions from 1 to 0 due to user close, the client SHALL call `window.close()`. If the page remains open, it SHALL show the empty state. In non-standalone browser tabs, closing the last session SHALL show empty state without closing the window. The daemon SHALL keep running (LaunchAgent and/or a process started by the native app). Closing the UI SHALL NOT stop the daemon.

#### Scenario: Last tab closes the standalone window
- **WHEN** the user closes the final tab in an installed PWA or native app window with `quit_when_no_tabs` true
- **THEN** `window.close()` is invoked to dismiss the app window while the daemon remains running

#### Scenario: Browser tab keeps empty state
- **WHEN** the user closes the final tab in a normal browser tab (not standalone)
- **THEN** the window stays open and the empty state UI is shown

#### Scenario: Feature can be disabled
- **WHEN** `quit_when_no_tabs` is false and the last tab is closed in standalone
- **THEN** the window remains open showing the empty state

#### Scenario: Native window close leaves daemon up
- **WHEN** the user closes the native app window
- **THEN** the daemon keeps serving existing sessions for the next launch
