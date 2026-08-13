## ADDED Requirements

### Requirement: Serve is idempotent when the port is already bound

If `webtabinal serve` is started while the configured `127.0.0.1` port is already accepting connections, the process SHALL treat that as success for the caller (no crash, no second listener) so a desktop app, LaunchAgent, and a manual `serve` can coexist.

#### Scenario: Second serve finds an existing listener

- **WHEN** `webtabinal serve` starts and `127.0.0.1:<port>` is already listening
- **THEN** it SHALL NOT bind a second listener and SHALL exit successfully or otherwise hand off without failing the desktop app launch

## MODIFIED Requirements

### Requirement: LaunchAgent install and CLI
The binary SHALL expose CLI subcommands `serve`, `install`, `uninstall`, `status`, and `open`. `install`/`uninstall` SHALL manage a launchd LaunchAgent labeled for WebTabinal with RunAtLoad and KeepAlive. LaunchAgent SHALL remain an optional way to keep the daemon running at login; the native desktop app SHALL be able to start `serve` without requiring a prior `install`.

#### Scenario: Install registers LaunchAgent
- **WHEN** the user runs `webtabinal install`
- **THEN** a plist is written under `~/Library/LaunchAgents/` and loaded so the daemon starts at login and restarts on exit

#### Scenario: Open launches the UI URL
- **WHEN** the user runs `webtabinal open`
- **THEN** the default browser opens the daemon URL

#### Scenario: Desktop app can start serve without install
- **WHEN** LaunchAgent is not installed and the user opens the native `.app`
- **THEN** the daemon still starts via `serve` as specified by `desktop-shell`
