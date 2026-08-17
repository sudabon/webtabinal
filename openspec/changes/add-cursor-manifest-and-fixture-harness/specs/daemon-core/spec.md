## MODIFIED Requirements

### Requirement: LaunchAgent install and CLI
The binary SHALL expose CLI subcommands `serve`, `install`, `uninstall`, `status`, `open`, and the nested read-only command `state snapshot <session-id>`. `install`/`uninstall` SHALL manage a launchd LaunchAgent labeled for WebTabinal with RunAtLoad and KeepAlive. LaunchAgent SHALL remain an optional way to keep the daemon running at login; the native desktop app SHALL be able to start `serve` without requiring a prior `install`. The state snapshot command SHALL query an already-running daemon through its authenticated loopback API and SHALL NOT start the daemon or write to a PTY.

#### Scenario: Install registers LaunchAgent
- **WHEN** the user runs `webtabinal install`
- **THEN** a plist is written under `~/Library/LaunchAgents/` and loaded so the daemon starts at login and restarts after an unsuccessful exit (`KeepAlive` with `SuccessfulExit` false). A successful exit (including idempotent “already listening”) does not trigger an automatic restart

#### Scenario: Open launches the UI URL
- **WHEN** the user runs `webtabinal open`
- **THEN** the default browser opens the daemon URL

#### Scenario: Desktop app can start serve without install
- **WHEN** LaunchAgent is not installed and the user opens the native `.app`
- **THEN** the daemon still starts via `serve` as specified by `desktop-shell`

#### Scenario: State snapshot queries the running daemon
- **WHEN** the user runs `webtabinal state snapshot <session-id>` while the configured daemon is available
- **THEN** the CLI authenticates with the stored token, prints the read-only diagnostic response, and does not create, close, reorder, resize, or write to any session

#### Scenario: State snapshot does not auto-start daemon
- **WHEN** the user runs `webtabinal state snapshot <session-id>` while the daemon is unavailable
- **THEN** the command exits non-zero without launching `serve` or loading a LaunchAgent
