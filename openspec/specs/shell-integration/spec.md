# shell-integration Specification

## Purpose
TBD - created by archiving change lterm-v01. Update Purpose after archive.

## Requirements

### Requirement: Ship and load zsh integration script
On startup the daemon SHALL write `~/Library/Application Support/WebTabinal/integration.zsh` (versioned; overwrite on update). The script SHALL no-op unless `WEBTABINAL_SESSION_ID` is set. Users SHALL source it from `.zshrc` with the documented one-liner.

#### Scenario: Integration file is written on start
- **WHEN** the daemon starts
- **THEN** `integration.zsh` exists under Application Support with the current embedded version

#### Scenario: Non-WebTabinal shells are unaffected
- **WHEN** zsh starts without `WEBTABINAL_SESSION_ID`
- **THEN** the integration script performs no OSC emission

### Requirement: Parse OSC for CWD command and state
The daemon SHALL parse PTY output for OSC 7 (CWD), OSC 133 A/C/D (prompt/start/end with exit code), and private OSC 9973 (base64 command line, and the shell-exit signal). It SHALL update session CWD, command, state, and exit code accordingly, set `Integrated=true` on first OSC 7, and still forward these sequences to the client terminal stream.

The shell-exit signal SHALL be recorded on the session as "the shell terminated at the user's request" and SHALL NOT by itself change the session's CWD, command, or idle/running state. An unrecognised OSC 9973 subtype SHALL be ignored without affecting session fields.

#### Scenario: cd updates live CWD
- **WHEN** the shell emits OSC 7 with a file URL for the new PWD
- **THEN** the session CWD is updated immediately for sidebar display

#### Scenario: preexec sets command and running
- **WHEN** OSC 9973 with a base64 command and OSC 133;C are received
- **THEN** the session command string is set and state becomes `running`

#### Scenario: precmd marks idle with exit code
- **WHEN** OSC 133;D;<exit> then OSC 133;A are received
- **THEN** the session state becomes `idle` and ExitCode reflects `<exit>`

#### Scenario: Shell exit signal is recorded without changing state

- **WHEN** the OSC 9973 shell-exit signal is received for an `idle` session
- **THEN** the session is marked as having been terminated at the user's request and its state, CWD, and command are unchanged

#### Scenario: Unknown OSC 9973 subtype is ignored

- **WHEN** an OSC 9973 sequence with an unrecognised subtype is received
- **THEN** no session field changes and the sequence is still forwarded to the client terminal stream

### Requirement: Fallback detection without integration
If integration is not detected, the daemon SHALL poll about once per second via `TIOCGPGRP` and process name to approximate idle vs running. Live CWD SHALL NOT be updated. The UI SHALL indicate missing integration.

#### Scenario: Foreground process implies running
- **WHEN** a non-integrated session’s foreground PGID differs from the shell PID
- **THEN** the session state is reported as `running` with best-effort command name

#### Scenario: Missing integration is visible
- **WHEN** a session has `Integrated=false`
- **THEN** the tab UI shows a non-integrated indicator

### Requirement: Inject bash OSC integration without a user rc snippet

When the configured shell’s basename is `bash`, the daemon SHALL write `integration.bash` and a bash inject rcfile under Application Support, spawn the session so that rcfile is used as bash `--rcfile`, and load OSC integration without requiring a one-liner in the user’s `~/.bashrc` or profile. The integration script SHALL no-op unless `WEBTABINAL_SESSION_ID` is set. Non-bash shells SHALL NOT use this bash inject path.

#### Scenario: Bash integration files are written on start

- **WHEN** the daemon starts
- **THEN** `integration.bash` and the bash inject rcfile exist under Application Support with the current embedded content

#### Scenario: New bash session becomes integrated without a bashrc snippet

- **WHEN** a session is created with shell basename `bash` and the user has no WebTabinal line in `~/.bashrc`
- **THEN** the session becomes integrated (`Integrated=true`) after the first prompt

#### Scenario: cd updates live CWD on bash

- **WHEN** an integrated bash session changes directory with `cd`
- **THEN** the session CWD is updated for sidebar display

#### Scenario: Command line updates on bash

- **WHEN** an integrated bash session runs a simple command
- **THEN** the session command string is set to that command and state becomes `running` until the prompt returns

#### Scenario: Non-WebTabinal bash shells are unaffected

- **WHEN** bash starts without `WEBTABINAL_SESSION_ID`
- **THEN** the integration script performs no OSC emission

#### Scenario: zsh injection is unchanged

- **WHEN** a session is created with shell basename `zsh`
- **THEN** bash `--rcfile` injection is not applied and the existing zsh ZDOTDIR injection still loads OSC integration

### Requirement: Parse OSC 9 and OSC 99 for notifications

The daemon SHALL parse PTY output for OSC 9 (iTerm2 Growl; payload after `9;`) and OSC 99 (Kitty desktop notification; `p=title` / `p=body` when present, otherwise the payload after the last `;`). Empty title and body SHALL produce no event. These sequences SHALL still be forwarded to the client terminal stream. Parsing them SHALL NOT change session CWD, command, or idle/running state.

#### Scenario: OSC 9 yields a notify event

- **WHEN** the PTY emits `ESC ] 9 ; Codex needs approval BEL`
- **THEN** the parser produces a notify event whose body is `Codex needs approval` and the session remains `running` if it was running

#### Scenario: OSC 99 uses title and body params

- **WHEN** the PTY emits an OSC 99 sequence with `p=title` `Claude Code` and `p=body` `Permission required`
- **THEN** the parser produces a notify event with title `Claude Code` and body `Permission required`

#### Scenario: Empty OSC 9 is ignored

- **WHEN** the PTY emits `ESC ] 9 ; BEL`
- **THEN** no notify event is produced

### Requirement: Signal shell termination before the shell exits

The zsh and bash integration scripts SHALL emit a private OSC shell-exit signal carrying the shell's final exit status immediately before the shell process terminates, so the daemon can distinguish a shell that ended at the user's request from a shell that died on its own. The signal SHALL be emitted at most once per session. It SHALL be emitted whether the shell ends via the `exit` builtin, end-of-file (Ctrl+D), or `logout`, and regardless of the exit status value.

The integration SHALL NOT displace a shell-exit hook or trap the user already installed: any pre-existing `EXIT` trap in bash and any pre-existing `zshexit` hook in zsh SHALL still run. As with every other part of the integration, the signal SHALL NOT be emitted when `WEBTABINAL_SESSION_ID` is unset.

A shell that is killed without running its exit hooks (for example `SIGKILL`) SHALL produce no shell-exit signal.

#### Scenario: Exiting an integrated zsh session signals termination

- **WHEN** the user types `exit` in an integrated zsh session
- **THEN** the daemon observes a shell-exit signal for that session before the PTY reports the process has ended

#### Scenario: Ctrl+D in an integrated bash session signals termination

- **WHEN** the user sends end-of-file at the prompt of an integrated bash session
- **THEN** the daemon observes a shell-exit signal for that session before the PTY reports the process has ended

#### Scenario: Non-zero last command still signals termination

- **WHEN** the user runs a command that exits with status 1 and then exits the shell
- **THEN** the daemon observes a shell-exit signal for that session even though the shell's own exit status is 1

#### Scenario: User's own exit hook still runs

- **WHEN** the user's startup files install a bash `EXIT` trap or a zsh `zshexit` hook and the shell exits
- **THEN** the user's trap or hook runs in addition to the WebTabinal shell-exit signal

#### Scenario: Non-WebTabinal shells emit nothing

- **WHEN** a shell that has no `WEBTABINAL_SESSION_ID` exits
- **THEN** the integration script emits no shell-exit signal

#### Scenario: Killed shell produces no signal

- **WHEN** the shell process is killed without running exit hooks
- **THEN** no shell-exit signal is observed for that session
