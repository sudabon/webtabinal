## MODIFIED Requirements

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
