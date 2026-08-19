## ADDED Requirements

### Requirement: Notification command whitelist editor

The Notifications category SHALL expose an editor for `notification.commands`. It SHALL list the persisted commands, let the user add a command, and let the user remove any listed command. Adding and removing SHALL persist immediately through the existing config API, so a command can be added while working without editing a file or restarting the daemon.

Submitted text SHALL be trimmed. A blank submission SHALL be rejected without a request. A command already in the list SHALL NOT be added twice. A failed update SHALL report an error and restore the last successfully persisted list.

The editor SHALL state that an empty list means every session may notify.

#### Scenario: Existing commands are listed

- **WHEN** the user opens the Notifications category with `notification.commands` set to `["claude","codex"]`
- **THEN** both commands are shown, each with a control that removes it

#### Scenario: Adding a command persists immediately

- **WHEN** the user types `make` into the add field and submits it
- **THEN** the client sends one config patch adding `make` to `notification.commands` and the list shows it without a save step

#### Scenario: Submitted text is trimmed

- **WHEN** the user submits `  make  `
- **THEN** `make` is added

#### Scenario: Blank submission is ignored

- **WHEN** the user submits an empty or whitespace-only value
- **THEN** no config patch is sent and the list is unchanged

#### Scenario: Duplicate command is not added twice

- **WHEN** the user submits a command that the list already contains
- **THEN** no config patch is sent and the list is unchanged

#### Scenario: Removing a command persists immediately

- **WHEN** the user activates the remove control for `codex`
- **THEN** the client sends one config patch without `codex` and the list no longer shows it

#### Scenario: Failed update is reported and rolled back

- **WHEN** a command patch fails
- **THEN** an error is reported and the editor shows the last successfully persisted list
