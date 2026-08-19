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

### Requirement: Notifications category
The settings modal SHALL include a Notifications category in addition to Appearance, General, and Keyboard. Appearance SHALL remain the initially selected category. The Notifications category SHALL show the persisted `notification.enabled` and `notification.always` values and the current platform authorization state.

#### Scenario: Notifications category is available
- **WHEN** the settings modal is open and the user activates the Notifications category
- **THEN** the category is selected and its enablement, focus-suppression override, and authorization controls are shown

#### Scenario: Appearance remains the initial category
- **WHEN** the settings modal opens
- **THEN** Appearance is selected even though the Notifications category is available

### Requirement: Notification settings persist immediately
Changing the notification enablement or always-notify control SHALL persist immediately through the existing config API without a save button. A failed update SHALL report an error and restore the last successfully persisted value.

#### Scenario: Enablement persists
- **WHEN** the user changes the notification enablement control
- **THEN** `notification.enabled` is patched immediately and the control reflects the persisted value

#### Scenario: Always-notify persists
- **WHEN** the user changes the always-notify control
- **THEN** `notification.always` is patched immediately and the control reflects the persisted value

#### Scenario: Failed notification setting rolls back
- **WHEN** the config API rejects a notification control change
- **THEN** the settings UI shows an error and restores the last successfully persisted value

### Requirement: Notification authorization control
The Notifications category SHALL display `default`, `granted`, `denied`, and `unsupported` authorization states in user-facing language. It SHALL offer an enable-permission action only while the state is `default`, and that action SHALL invoke the current environment’s permission request directly from the user activation. The state SHALL be refreshed when the category is opened and when the window regains focus.

#### Scenario: Default state offers permission action
- **WHEN** the user opens the Notifications category and authorization is `default`
- **THEN** the UI explains that OS/browser permission is required and offers a notification permission action

#### Scenario: Permission result updates the UI
- **WHEN** the user activates the permission action and the platform returns `granted` or `denied`
- **THEN** the displayed authorization state updates without reloading the application

#### Scenario: Granted state is visible
- **WHEN** authorization is `granted`
- **THEN** the UI shows that system notifications are allowed and does not show the permission request action

#### Scenario: Denied state gives recovery guidance
- **WHEN** authorization is `denied`
- **THEN** the UI explains that permission must be changed in System Settings or browser site settings and does not claim that another request will show a prompt

#### Scenario: Focus refresh observes external changes
- **WHEN** the user changes notification permission outside WebTabinal and returns focus to the window
- **THEN** the Notifications category refreshes and displays the current authorization state

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

### Requirement: Notification command whitelist editor

The Notifications category SHALL expose an editor for `notification.commands`. It SHALL list the persisted commands, let the user add a command, and let the user remove any listed command. Adding and removing SHALL persist immediately through the existing config API, so a command can be added while working without editing a file or restarting the daemon.

Submitted text SHALL be trimmed. A blank submission SHALL be rejected without a request. A command already in the list SHALL NOT be added twice, comparing without regard to case. A failed update SHALL report an error and restore the last successfully persisted list.

The add field SHALL disable automatic capitalization, autocorrection, spellchecking, and autocomplete, so the host platform does not alter a command name as it is typed.

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

#### Scenario: Duplicate differing only in case is not added

- **WHEN** the list contains `claude` and the user submits `Claude`
- **THEN** no config patch is sent and the list is unchanged

#### Scenario: The platform does not alter a typed command

- **WHEN** the add field is rendered
- **THEN** automatic capitalization, autocorrection, spellchecking, and autocomplete are disabled on it

#### Scenario: Removing a command persists immediately

- **WHEN** the user activates the remove control for `codex`
- **THEN** the client sends one config patch without `codex` and the list no longer shows it

#### Scenario: Failed update is reported and rolled back

- **WHEN** a command patch fails
- **THEN** an error is reported and the editor shows the last successfully persisted list
