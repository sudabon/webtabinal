# desktop-shell Specification

## Purpose
macOS native application shell that starts the WebTabinal daemon when needed and displays the loopback UI in a WKWebView window.
## Requirements
### Requirement: Native app starts daemon then shows UI
The system SHALL provide a macOS application bundle that, on launch, ensures the WebTabinal daemon is listening on loopback and then displays the daemon UI in a native window.

#### Scenario: Cold start launches daemon and window
- **WHEN** the user opens the WebTabinal `.app` and nothing is listening on the configured loopback port
- **THEN** the app starts `webtabinal serve` and opens a window to that URL

#### Scenario: Warm start reuses running daemon
- **WHEN** the user opens the WebTabinal `.app` and the daemon is already listening on the configured loopback port
- **THEN** the app does not start a second daemon and opens a window to the existing URL

#### Scenario: Startup failure is visible
- **WHEN** the app cannot obtain a listening daemon within the startup timeout
- **THEN** it SHALL show an error that points to the daemon log path and SHALL NOT show an empty WebView as if the product were running

### Requirement: Window close does not stop the daemon
Closing the native app window SHALL NOT terminate the daemon or destroy sessions.

#### Scenario: Close window keeps sessions
- **WHEN** the user closes the native app window while sessions exist
- **THEN** the daemon continues running and those sessions remain available on the next launch

### Requirement: App icon matches product favicon
The native app bundle icon SHALL be generated from the same artwork as the web favicon (`icon.svg`).

#### Scenario: Dock icon matches favicon
- **WHEN** the `.app` is installed or run
- **THEN** the Dock / Finder icon is the terminal-chevron artwork used by the web UI, not a placeholder
