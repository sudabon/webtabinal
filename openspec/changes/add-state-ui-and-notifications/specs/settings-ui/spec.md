## ADDED Requirements

### Requirement: Agent state controls in notification settings

The Notifications settings category SHALL provide controls for `state.enabled` and `state.notify_on_blocked`, plus an advanced section for debounce milliseconds, quiescence milliseconds, bottom lines, and manifest directory. The UI SHALL explain that manifest-specific values override global timing and line defaults and that changing the manifest directory requires a daemon restart.

#### Scenario: User disables state detection
- **WHEN** the user turns off agent state detection
- **THEN** the UI patches `state.enabled=false`, retains the other state values, and presents dependent controls as disabled

#### Scenario: User changes an advanced default
- **WHEN** the user enters a valid quiescence or bottom-lines value
- **THEN** the value is persisted through the config API and the confirmed value remains after reopening settings

#### Scenario: Manifest directory communicates restart behavior
- **WHEN** the manifest directory control is visible
- **THEN** its help text states that an empty value uses the default directory and a changed directory is loaded after daemon restart

### Requirement: Agent state setting updates are validated and recoverable

Agent state settings SHALL use the existing immediate-persistence flow. A failed patch SHALL restore the last confirmed values and show a visible error without changing unrelated notification settings.

#### Scenario: Invalid numeric value rolls back
- **WHEN** the user submits a debounce, quiescence, or bottom-lines value rejected by the daemon
- **THEN** the control returns to the last confirmed value and displays the error

#### Scenario: Failed state patch preserves notification settings
- **WHEN** an agent state patch fails while `notification.enabled` and `notification.always` already have saved values
- **THEN** those notification values remain unchanged

#### Scenario: Re-enable restores dependent controls
- **WHEN** the user re-enables state detection after disabling it
- **THEN** the retained advanced values become editable again and the daemon re-evaluates live sessions
