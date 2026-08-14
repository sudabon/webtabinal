# session-pty Specification

## Purpose
TBD - created by archiving change lterm-v01. Update Purpose after archive.
## Requirements
### Requirement: Session model and state machine
Each session SHALL have an ID (UUIDv4), order, live CWD, command string, state (`starting` | `idle` | `running` | `exited`), optional exit code, run start time, ring buffer, integrated flag, and cols/rows. State SHALL transition `starting` → `idle` ⇄ `running` → `exited` per shell-integration events or PTY EOF.

#### Scenario: New session starts in starting then becomes idle
- **WHEN** a session is created and the first prompt OSC is observed (or equivalent)
- **THEN** the session state becomes `idle`

#### Scenario: Command run moves idle to running
- **WHEN** an integrated session receives a command-start signal
- **THEN** the session state becomes `running` and RunStarted is recorded

### Requirement: Create duplicate restart and close lifecycle

The system SHALL create sessions with the configured shell executable. When the shell basename is `zsh`, it SHALL be spawned as an interactive login shell (`-il`) with the existing ZDOTDIR injection. When the shell basename is `bash`, it SHALL be spawned as an interactive shell (`-i`) with `--rcfile` pointing at the WebTabinal bash inject rcfile so OSC integration loads without a user one-liner. On bash 3.2, `--rcfile` SHALL precede `-i`. Default CWD is `~` (duplicate inherits live CWD), and env SHALL include `WEBTABINAL_SESSION_ID=<id>`. Close SHALL send SIGHUP, wait up to 3 seconds, then SIGKILL. Closing a `running` session from the UI SHALL confirm when `confirm_close_running` is true. Exited tabs SHALL remain unless `close_tab_on_clean_exit` is true and exit code is 0. Restart SHALL respawn at the last live CWD.

#### Scenario: Duplicate inherits CWD

- **WHEN** the client duplicates a session whose live CWD is `/Users/me/proj`
- **THEN** the new session starts with CWD `/Users/me/proj`

#### Scenario: Running close requires confirmation when enabled

- **WHEN** the user closes a `running` session and `confirm_close_running` is true
- **THEN** a confirmation dialog is shown before the session is terminated

#### Scenario: Clean exit auto-close when configured

- **WHEN** `close_tab_on_clean_exit` is true and a session exits with code 0
- **THEN** the session is removed from the session list

#### Scenario: Exited session can restart

- **WHEN** the user restarts an `exited` session
- **THEN** a new PTY is spawned using the last live CWD

#### Scenario: Bash session uses inject rcfile

- **WHEN** config `shell` has basename `bash` and the client creates a session
- **THEN** the PTY is spawned with `--rcfile` pointing at the WebTabinal bash inject rcfile followed by `-i`, not as a login shell that ignores `--rcfile`

### Requirement: Per-session ring buffer for scrollback
Each session SHALL keep a byte ring buffer (default 5 MiB, configurable via `ring_buffer_bytes`) of PTY output for replay on attach.

#### Scenario: Buffer retains recent output
- **WHEN** a session produces more than `ring_buffer_bytes` of output
- **THEN** older bytes are discarded and the newest bytes remain available for replay

### Requirement: Session order is authoritative on the daemon
Session sidebar order SHALL be stored as `Order` on the daemon and updated atomically when the client commits a reorder.

#### Scenario: Reorder updates daemon order
- **WHEN** the client sends an ordered list of session IDs
- **THEN** subsequent session list responses reflect that order from top to bottom

### Requirement: Session memo field

Each session SHALL have a memo string of at most 30 Unicode code points (empty allowed). New sessions SHALL start with an empty memo. Duplicate SHALL NOT copy the source memo. Restart SHALL copy the source memo onto the replacement session.

#### Scenario: New session has empty memo

- **WHEN** a session is created
- **THEN** its memo is empty

#### Scenario: Duplicate does not copy memo

- **WHEN** the user duplicates a session whose memo is `CI watch`
- **THEN** the new session has an empty memo

#### Scenario: Restart preserves memo

- **WHEN** the user restarts an exited session whose memo is `CI watch`
- **THEN** the replacement session has memo `CI watch`

### Requirement: Configured shell is applied at session creation

New sessions SHALL spawn the executable currently stored in config `shell`. Changing `shell` SHALL NOT replace the process of an already running or idle session.

#### Scenario: New tab uses the configured shell

- **WHEN** config `shell` is `/bin/bash` and the client creates a session
- **THEN** the new PTY is spawned from `/bin/bash`

#### Scenario: Duplicate uses the configured shell

- **WHEN** config `shell` has changed since the source session was created and the client duplicates that session
- **THEN** the new session is spawned from the current config `shell`, not the source session’s original executable

#### Scenario: Restart uses the configured shell

- **WHEN** config `shell` has changed and the client restarts an exited session
- **THEN** the replacement session is spawned from the current config `shell`

#### Scenario: Open sessions keep their spawned shell

- **WHEN** the user changes config `shell` while a session is `idle` or `running`
- **THEN** that session’s existing PTY continues with the executable it was spawned with

