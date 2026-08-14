## ADDED Requirements

### Requirement: General category

The settings modal SHALL include a General category in the left navigation in addition to Appearance.

#### Scenario: General is available

- **WHEN** the settings modal is open and the user activates the General category
- **THEN** the General category is selected and its content is shown in the right pane

#### Scenario: Appearance remains the initial category

- **WHEN** the settings modal opens
- **THEN** the Appearance category is selected and its content is shown in the right pane

### Requirement: Default shell path editor

The General category SHALL present the configured default shell as an absolute-path text field. Committing the field SHALL persist via the existing config API without a save button.

#### Scenario: Current shell is shown

- **WHEN** the user opens the General category
- **THEN** the shell field shows the current `shell` value from config

#### Scenario: Commit on blur persists a valid path

- **WHEN** the user edits the shell field to a valid executable absolute path and the field loses focus
- **THEN** the system persists that path immediately and subsequent config reads return it

#### Scenario: Commit on Enter persists a valid path

- **WHEN** the user edits the shell field to a valid executable absolute path and presses Enter
- **THEN** the system persists that path immediately and subsequent config reads return it

#### Scenario: Unchanged value is not patched

- **WHEN** the shell field loses focus or receives Enter and its value equals the last persisted shell
- **THEN** the system does not send a config patch

### Requirement: Invalid shell path is rejected in the UI

If persisting the shell path fails, the system SHALL show an error and restore the last successfully persisted value in the field.

#### Scenario: Invalid path rolls back

- **WHEN** the user commits a shell path that the server rejects
- **THEN** an error is shown and the shell field shows the last successfully persisted value

## MODIFIED Requirements

### Requirement: Appearance category

The settings modal SHALL include an Appearance category in the left navigation. Appearance SHALL be the selected category when the modal opens.

#### Scenario: Appearance is available

- **WHEN** the settings modal opens
- **THEN** the Appearance category is selected and its content is shown in the right pane

### Requirement: Immediate persistence of settings changes

Settings changes made in the modal SHALL be applied and persisted immediately without a save button. For a free-text field, a change is committed when the field loses focus or the user presses Enter, not on each keystroke.

#### Scenario: Change persists without save button

- **WHEN** the user commits a setting in the modal
- **THEN** the system persists the change immediately and the UI reflects the new value without requiring a separate save action
