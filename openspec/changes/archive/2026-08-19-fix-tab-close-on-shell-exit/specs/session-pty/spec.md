## MODIFIED Requirements

### Requirement: Create duplicate restart and close lifecycle

The system SHALL create sessions with the configured shell executable. When the shell basename is `zsh`, it SHALL be spawned as an interactive login shell (`-il`) with the existing ZDOTDIR injection. When the shell basename is `bash`, it SHALL be spawned as an interactive shell (`-i`) with `--rcfile` pointing at the WebTabinal bash inject rcfile so OSC integration loads without a user one-liner. On bash 3.2, `--rcfile` SHALL precede `-i`. Default CWD is `~` (duplicate inherits live CWD), and env SHALL include `WEBTABINAL_SESSION_ID=<id>`. Close SHALL send SIGHUP, wait up to 3 seconds, then SIGKILL. Closing a `running` session from the UI SHALL confirm when `confirm_close_running` is true. Restart SHALL respawn at the last live CWD.

Exited tabs SHALL remain in the session list unless `close_tab_on_clean_exit` is true and the shell ended at the user's request. A shell SHALL be treated as having ended at the user's request when the daemon has recorded a shell-exit signal for that session, regardless of the shell's exit status; a shell without such a signal SHALL be treated as having ended at the user's request only when its exit status is 0. This distinction matters because `exit` and end-of-file return the status of the last command run, so a user-initiated exit frequently carries a non-zero status.

Regardless of `close_tab_on_clean_exit`, a session that exits before it ever reaches its first prompt SHALL keep its tab, so that shell startup failures stay visible to the user.

Before the daemon decides whether to close the tab, it SHALL make a bounded wait for the session's pending PTY output to be processed, so that a shell-exit signal emitted immediately before termination is not missed.

#### Scenario: Duplicate inherits CWD

- **WHEN** the client duplicates a session whose live CWD is `/Users/me/proj`
- **THEN** the new session starts with CWD `/Users/me/proj`

#### Scenario: Running close requires confirmation when enabled

- **WHEN** the user closes a `running` session and `confirm_close_running` is true
- **THEN** a confirmation dialog is shown before the session is terminated

#### Scenario: Clean exit auto-close when configured

- **WHEN** `close_tab_on_clean_exit` is true and a session exits with code 0
- **THEN** the session is removed from the session list

#### Scenario: User exit after a failing command auto-closes

- **WHEN** `close_tab_on_clean_exit` is true, the user runs a command that exits with status 1 and then exits the shell, and a shell-exit signal was recorded for that session
- **THEN** the session is removed from the session list even though its exit status is 1

#### Scenario: Shell that dies without a user exit keeps its tab

- **WHEN** `close_tab_on_clean_exit` is true and an integrated session's shell terminates with a non-zero status without a recorded shell-exit signal
- **THEN** the session stays in the list as `exited` so the user can read its output and restart it

#### Scenario: Auto-close disabled keeps every exited tab

- **WHEN** `close_tab_on_clean_exit` is false and a session exits for any reason
- **THEN** the session stays in the list as `exited`

#### Scenario: Startup failure keeps its tab

- **WHEN** a session's shell exits before the first prompt is observed
- **THEN** the session stays in the list as `exited` regardless of `close_tab_on_clean_exit` and its exit status

#### Scenario: Exited session can restart

- **WHEN** the user restarts an `exited` session
- **THEN** a new PTY is spawned using the last live CWD

#### Scenario: Bash session uses inject rcfile

- **WHEN** config `shell` has basename `bash` and the client creates a session
- **THEN** the PTY is spawned with `--rcfile` pointing at the WebTabinal bash inject rcfile followed by `-i`, not as a login shell that ignores `--rcfile`
