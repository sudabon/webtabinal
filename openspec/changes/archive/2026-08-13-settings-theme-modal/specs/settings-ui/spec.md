## ADDED Requirements

### Requirement: Settings entry in sidebar

The system SHALL provide a settings control below the new-tab control in the left sidebar.

#### Scenario: Open settings from sidebar

- **WHEN** the user activates the settings control in the sidebar
- **THEN** the settings modal is shown

### Requirement: Settings modal layout

The settings modal SHALL present a left navigation pane and a right content pane, and SHALL provide a cancel (close) control without a separate save action.

#### Scenario: Close via cancel

- **WHEN** the settings modal is open and the user activates cancel
- **THEN** the modal closes

#### Scenario: Close via Escape

- **WHEN** the settings modal is open and the user presses Escape
- **THEN** the modal closes

#### Scenario: Close via backdrop

- **WHEN** the settings modal is open and the user activates the backdrop outside the dialog
- **THEN** the modal closes

### Requirement: Appearance category

The settings modal SHALL include an Appearance category in the left navigation as the initial (and only required) category for this change.

#### Scenario: Appearance is available

- **WHEN** the settings modal opens
- **THEN** the Appearance category is selected and its content is shown in the right pane

### Requirement: Immediate persistence of settings changes

Settings changes made in the modal SHALL be applied and persisted immediately without a save button.

#### Scenario: Change persists without save button

- **WHEN** the user changes a setting in the modal
- **THEN** the system persists the change immediately and the UI reflects the new value without requiring a separate save action
