## ADDED Requirements

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

## MODIFIED Requirements

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
