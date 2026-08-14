# settings-ui Specification

## Purpose
TBD - created by archiving change settings-theme-modal. Update Purpose after archive.
## Requirements
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

The settings modal SHALL include an Appearance category in the left navigation. Appearance SHALL be the selected category when the modal opens.

#### Scenario: Appearance is available

- **WHEN** the settings modal opens
- **THEN** the Appearance category is selected and its content is shown in the right pane

### Requirement: Immediate persistence of settings changes

Settings changes made in the modal SHALL be applied and persisted immediately without a save button. For a free-text field, a change is committed when the field loses focus or the user presses Enter, not on each keystroke.

#### Scenario: Change persists without save button

- **WHEN** the user commits a setting in the modal
- **THEN** the system persists the change immediately and the UI reflects the new value without requiring a separate save action

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

### Requirement: Shell field describes live sidebar updates for zsh and bash

The General category shell field SHALL include a short hint that zsh and bash sessions update the sidebar current directory and command live, and that the value applies to new tabs.

#### Scenario: Hint mentions zsh and bash live updates

- **WHEN** the user opens the General category
- **THEN** the shell field hint states that zsh and bash sessions update the sidebar current directory and command, and that the setting applies to new tabs

### Requirement: Keyboard category

The settings modal SHALL include a Keyboard category in the left navigation in addition to Appearance and General. Appearance SHALL remain the category selected when the modal opens.

#### Scenario: Keyboard is available

- **WHEN** the settings modal is open and the user activates the Keyboard category
- **THEN** the Keyboard category is selected and its content is shown in the right pane

### Requirement: Tab navigation shortcut toggle

The Keyboard category SHALL present an enable / disable control for the tab navigation shortcut, reflecting the persisted state. Toggling it SHALL persist immediately via the existing config API without a save button.

#### Scenario: Toggle reflects the persisted state

- **WHEN** the user opens the Keyboard category
- **THEN** the toggle shows whether the tab navigation shortcut is currently enabled

#### Scenario: Enabling persists immediately

- **WHEN** the user turns the toggle on
- **THEN** the change is persisted immediately and the shortcut is active without reloading

### Requirement: Key binding recorder

The Keyboard category SHALL present the prefix key, the next-tab key, and the previous-tab key as separate controls that display the current binding. Activating a control SHALL enter a recording state in which the next keystroke is captured as that binding instead of triggering any application shortcut, and the captured binding SHALL be persisted immediately. `Escape` SHALL cancel recording and leave the binding unchanged.

#### Scenario: Current bindings are shown

- **WHEN** the user opens the Keyboard category
- **THEN** each control shows the persisted binding in readable form, for example `Ctrl+J`, `N`, `P`

#### Scenario: Recording captures the next keystroke

- **WHEN** the user activates the next-tab control and presses `j`
- **THEN** the next-tab binding becomes `j`, the control shows it, and the change is persisted immediately

#### Scenario: Recording does not trigger shortcuts

- **WHEN** the user is recording a binding and presses a keystroke that is normally an application shortcut
- **THEN** that shortcut does not run and the keystroke is captured as the binding candidate

#### Scenario: Escape cancels recording

- **WHEN** the user is recording a binding and presses `Escape`
- **THEN** recording ends, the binding is unchanged, and the settings modal stays open

### Requirement: Rejected bindings are reported and rolled back

If a recorded binding is invalid or fails to persist, the Keyboard category SHALL show an error explaining the reason and SHALL restore the last successfully persisted binding in the control.

#### Scenario: Invalid binding rolls back

- **WHEN** the user records a prefix without a modifier key
- **THEN** an error explaining that the prefix needs a modifier is shown and the control returns to the last persisted prefix

#### Scenario: Duplicate binding rolls back

- **WHEN** the user records a previous-tab key that equals the next-tab key
- **THEN** an error explaining the conflict is shown and the control returns to the last persisted key

### Requirement: Reset key bindings to defaults

The Keyboard category SHALL provide a control that restores the default bindings (prefix `Ctrl+J`, next `N`, previous `P`) and persists them immediately. Resetting SHALL NOT change the enable / disable state.

#### Scenario: Reset restores defaults

- **WHEN** bindings have been changed and the user activates the reset control
- **THEN** the three controls show the default bindings and the change is persisted immediately

#### Scenario: Reset keeps the toggle state

- **WHEN** the shortcut is enabled and the user activates the reset control
- **THEN** the shortcut remains enabled

