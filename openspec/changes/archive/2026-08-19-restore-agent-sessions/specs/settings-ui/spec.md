## ADDED Requirements

### Requirement: Agent session restore toggle

The General category SHALL present a toggle that enables or disables restoring coding-agent sessions when the daemon starts. The toggle SHALL reflect the stored `restore.enabled` value, SHALL persist immediately through the existing config API without a save button, and its description SHALL state that restored tabs run the agent's resume command automatically. Per-agent resume command overrides SHALL NOT be editable from the settings UI.

#### Scenario: Toggle reflects the stored value

- **WHEN** the settings modal opens the General category while `restore.enabled` is false
- **THEN** the restore toggle is shown in the off position

#### Scenario: Turning the toggle off persists immediately

- **WHEN** the user turns the restore toggle off
- **THEN** the client patches `restore.enabled` to false without a save button and the stored config reflects it

#### Scenario: Resume commands are not editable in the UI

- **WHEN** the user views the General category
- **THEN** no editor for per-agent resume commands is presented
