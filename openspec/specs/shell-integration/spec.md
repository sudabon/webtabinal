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
The daemon SHALL parse PTY output for OSC 7 (CWD), OSC 133 A/C/D (prompt/start/end with exit code), and private OSC 9973 (base64 command line). It SHALL update session CWD, command, state, and exit code accordingly, set `Integrated=true` on first OSC 7, and still forward these sequences to the client terminal stream.

#### Scenario: cd updates live CWD
- **WHEN** the shell emits OSC 7 with a file URL for the new PWD
- **THEN** the session CWD is updated immediately for sidebar display

#### Scenario: preexec sets command and running
- **WHEN** OSC 9973 with a base64 command and OSC 133;C are received
- **THEN** the session command string is set and state becomes `running`

#### Scenario: precmd marks idle with exit code
- **WHEN** OSC 133;D;<exit> then OSC 133;A are received
- **THEN** the session state becomes `idle` and ExitCode reflects `<exit>`

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

