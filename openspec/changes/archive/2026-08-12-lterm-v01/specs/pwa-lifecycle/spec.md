## ADDED Requirements

### Requirement: Installable PWA package
The app SHALL ship `manifest.webmanifest` with `display: standalone`, name/short_name, theme_color, and icons (192/512 including maskable), plus a minimal service worker for installability. Offline caching is not required for v0.1.

#### Scenario: Manifest enables install
- **WHEN** the user opens the app in a supporting browser
- **THEN** the browser offers install / Add to Dock based on the provided manifest and service worker

### Requirement: Quit when last tab closes in standalone
When `quit_when_no_tabs` is true and `matchMedia('(display-mode: standalone)').matches`, and the sessions list transitions from 1 to 0 due to user close, the client SHALL call `window.close()`. If the page remains open, it SHALL show the empty state. In non-standalone browser tabs, closing the last session SHALL show empty state without closing the window. The daemon SHALL keep running under launchd.

#### Scenario: Last tab closes the standalone window
- **WHEN** the user closes the final tab in an installed PWA with `quit_when_no_tabs` true
- **THEN** `window.close()` is invoked to dismiss the app window while the daemon remains running

#### Scenario: Browser tab keeps empty state
- **WHEN** the user closes the final tab in a normal browser tab (not standalone)
- **THEN** the window stays open and the empty state UI is shown

#### Scenario: Feature can be disabled
- **WHEN** `quit_when_no_tabs` is false and the last tab is closed in standalone
- **THEN** the window remains open showing the empty state

### Requirement: beforeunload when running sessions exist
When at least one session is `running`, the client SHALL prompt on window close via `beforeunload` unless the corresponding confirm setting disables it. This SHALL not conflict with quit-on-last-tab because that path has zero sessions at quit time.

#### Scenario: Running session warns on window close
- **WHEN** a running session exists and the user attempts to close the window
- **THEN** the browser’s beforeunload confirmation is presented
