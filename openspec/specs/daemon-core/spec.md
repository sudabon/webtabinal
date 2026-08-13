# daemon-core Specification

## Purpose
TBD - created by archiving change lterm-v01. Update Purpose after archive.
## Requirements
### Requirement: Single local Go binary serves embedded frontend
The system SHALL provide a single Go binary named `webtabinal` that binds HTTP/WebSocket only to `127.0.0.1`, embeds the built frontend via `embed.FS`, and serves it alongside the API. The product display name SHALL be WebTabinal.

#### Scenario: Daemon starts on loopback
- **WHEN** the user runs `webtabinal serve` (or launchd starts the daemon)
- **THEN** the process listens on `127.0.0.1:8642` by default (or the configured port) and does not bind to `0.0.0.0`

#### Scenario: Frontend is served from the binary
- **WHEN** a browser requests `/` from the daemon
- **THEN** the embedded SPA assets are returned without requiring a separate static server

### Requirement: Config file with defaults
The daemon SHALL create `~/Library/Application Support/WebTabinal/config.json` on first launch with documented defaults (port `8642`, shell, scrollback, ring buffer, font_family `Menlo, Monaco, 'Courier New', monospace`, font_size `14`, sidebar width, notification, confirm_close_running, copy_on_select, quit_when_no_tabs, close_tab_on_clean_exit) and load it on subsequent starts.

#### Scenario: First launch creates config
- **WHEN** the config file does not exist at startup
- **THEN** the daemon writes defaults and continues with those values

#### Scenario: Existing config is respected
- **WHEN** the config file already exists
- **THEN** the daemon uses its values for port, shell, font, and related settings

### Requirement: LaunchAgent install and CLI
The binary SHALL expose CLI subcommands `serve`, `install`, `uninstall`, `status`, and `open`. `install`/`uninstall` SHALL manage a launchd LaunchAgent labeled for WebTabinal with RunAtLoad and KeepAlive. LaunchAgent SHALL remain an optional way to keep the daemon running at login; the native desktop app SHALL be able to start `serve` without requiring a prior `install`.

#### Scenario: Install registers LaunchAgent
- **WHEN** the user runs `webtabinal install`
- **THEN** a plist is written under `~/Library/LaunchAgents/` and loaded so the daemon starts at login and restarts after an unsuccessful exit (`KeepAlive` with `SuccessfulExit` false). A successful exit (including idempotent “already listening”) does not trigger an automatic restart

#### Scenario: Open launches the UI URL
- **WHEN** the user runs `webtabinal open`
- **THEN** the default browser opens the daemon URL

#### Scenario: Desktop app can start serve without install
- **WHEN** LaunchAgent is not installed and the user opens the native `.app`
- **THEN** the daemon still starts via `serve` as specified by `desktop-shell`

### Requirement: Serve is idempotent when the port is already bound
If `webtabinal serve` is started while the configured `127.0.0.1` port is already accepting connections, the process SHALL treat that as success for the caller (no crash, no second listener) so a desktop app, LaunchAgent, and a manual `serve` can coexist.

#### Scenario: Second serve finds an existing listener
- **WHEN** `webtabinal serve` starts and `127.0.0.1:<port>` is already listening
- **THEN** it SHALL NOT bind a second listener and SHALL exit successfully or otherwise hand off without failing the desktop app launch

### Requirement: Rotating daemon log
The daemon SHALL write logs to `~/Library/Logs/WebTabinal/daemon.log` with size-based rotation.

#### Scenario: Log file is written
- **WHEN** the daemon runs and handles requests or session events
- **THEN** log lines are appended under `~/Library/Logs/WebTabinal/daemon.log`

