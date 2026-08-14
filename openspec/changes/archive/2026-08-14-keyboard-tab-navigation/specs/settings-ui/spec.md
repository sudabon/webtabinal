## ADDED Requirements

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
