## ADDED Requirements

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
