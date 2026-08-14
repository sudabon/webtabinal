## ADDED Requirements

### Requirement: Prefix chord for tab navigation

The system SHALL provide a two-stroke keyboard shortcut for moving between tabs: a prefix key, followed by a next-tab key or a previous-tab key. While the shortcut is enabled and no modal or text field has focus, the prefix keystroke SHALL arm a pending state instead of being delivered to the terminal, and the following next/previous keystroke SHALL move the active tab instead of being delivered to the terminal.

#### Scenario: Prefix then next key moves down one tab

- **WHEN** the shortcut is enabled with prefix `ctrl+j`, next `n`, and the user presses `Ctrl+J` then `n` while the terminal is focused
- **THEN** the tab below the active one in sidebar order becomes active and neither keystroke is written to the PTY

#### Scenario: Prefix then previous key moves up one tab

- **WHEN** the shortcut is enabled with prefix `ctrl+j`, previous `p`, and the user presses `Ctrl+J` then `p` while the terminal is focused
- **THEN** the tab above the active one in sidebar order becomes active and neither keystroke is written to the PTY

#### Scenario: Prefix alone does not reach the PTY

- **WHEN** the shortcut is enabled and the user presses the prefix key while the terminal is focused
- **THEN** the pending state is armed and the prefix control character is not written to the PTY

### Requirement: Tab navigation order and wrap-around

Next SHALL select the session that follows the active session in sidebar order, and previous SHALL select the session that precedes it. At either end the selection SHALL wrap to the opposite end. With a single session, or with no active session, the navigation SHALL be a no-op that still consumes the keystroke.

#### Scenario: Next from the last tab wraps to the first

- **WHEN** the last tab in sidebar order is active and the user completes the next-tab chord
- **THEN** the first tab becomes active

#### Scenario: Previous from the first tab wraps to the last

- **WHEN** the first tab in sidebar order is active and the user completes the previous-tab chord
- **THEN** the last tab becomes active

#### Scenario: Single tab is a no-op

- **WHEN** exactly one session exists and the user completes a navigation chord
- **THEN** that session stays active and no keystroke is written to the PTY

### Requirement: Pending prefix state is visible and cancellable

While the pending state is armed, the UI SHALL show an indicator naming the armed prefix. The pending state SHALL be cleared by `Escape`, by a period of inactivity, by the window losing focus, and by opening the settings modal or the tab memo editor. A key that is neither the next-tab key nor the previous-tab key SHALL clear the pending state and SHALL NOT move tabs.

#### Scenario: Indicator appears while armed

- **WHEN** the user presses the prefix key
- **THEN** an indicator showing that the prefix is armed is displayed until the pending state is cleared

#### Scenario: Escape cancels the pending prefix

- **WHEN** the pending state is armed and the user presses `Escape`
- **THEN** the pending state is cleared, the indicator disappears, and no tab movement occurs

#### Scenario: Inactivity cancels the pending prefix

- **WHEN** the pending state has been armed and the timeout elapses without a further keystroke
- **THEN** the pending state is cleared and the next keystroke is handled normally

#### Scenario: Unbound key after the prefix does not move tabs

- **WHEN** the pending state is armed and the user presses a key that is not bound to next or previous
- **THEN** the pending state is cleared and the active tab does not change

### Requirement: Navigation reuses tab selection behavior

Moving to a tab through the shortcut SHALL behave like selecting that tab in the sidebar: the session becomes active and attached, keyboard focus moves to its terminal, and its unread completion dot is cleared.

#### Scenario: Shortcut focuses the shell

- **WHEN** the user completes a navigation chord and at least two sessions exist
- **THEN** the newly active session accepts keyboard input without a further click on the terminal pane

#### Scenario: Shortcut clears the unread dot

- **WHEN** the user navigates to a tab that has an unread completion dot
- **THEN** that dot is cleared

### Requirement: Key binding notation

A binding SHALL be stored as a normalized string of optional modifiers followed by a single base key, lowercased, joined with `+`, with modifiers in the fixed order `ctrl`, `alt`, `shift`, `meta` (for example `ctrl+j`, `n`, `ctrl+shift+arrowdown`). Matching a keystroke against a binding SHALL compare the normalized modifiers and base key, and SHALL be independent of keyboard layout casing.

#### Scenario: Modifier order is normalized

- **WHEN** a binding is recorded from a keystroke with Shift and Ctrl held together with `p`
- **THEN** it is stored as `ctrl+shift+p`

#### Scenario: Shifted letter matches its binding

- **WHEN** the next-tab binding is `n` and the user presses `n`
- **THEN** the keystroke matches the binding

### Requirement: Bindings are configurable and persisted

The enabled flag, prefix key, next-tab key, and previous-tab key SHALL be stored in the daemon config and SHALL be editable at runtime. A change SHALL take effect without restarting the daemon or reloading the UI, and SHALL survive a restart.

#### Scenario: Rebinding takes effect immediately

- **WHEN** the user changes the next-tab key to `j` and persists it
- **THEN** the prefix followed by `j` moves to the next tab in the same session

#### Scenario: Bindings survive restart

- **WHEN** the daemon and UI are restarted after bindings were changed
- **THEN** the changed bindings are in effect

### Requirement: Binding validation

The system SHALL reject a binding set in which: the prefix has no modifier key; the next-tab key and the previous-tab key are equal; any binding is `Escape`; or the prefix equals an existing application shortcut (`Cmd+1`..`Cmd+9`, `Cmd+N`, `Cmd+C`, `Cmd+V`). A rejected set SHALL NOT be persisted, and the previously persisted set SHALL remain in effect.

#### Scenario: Prefix without a modifier is rejected

- **WHEN** the user tries to set the prefix to `j` with no modifier
- **THEN** the change is rejected, an error is shown, and the previous prefix stays in effect

#### Scenario: Duplicate next and previous keys are rejected

- **WHEN** the user tries to set the previous-tab key to the current next-tab key
- **THEN** the change is rejected, an error is shown, and the previous binding stays in effect

#### Scenario: Prefix colliding with an existing shortcut is rejected

- **WHEN** the user tries to set the prefix to `Cmd+N`
- **THEN** the change is rejected, an error is shown, and the previous prefix stays in effect

### Requirement: Disabled by default and passthrough when disabled

The tab navigation shortcut SHALL be disabled by default, with the default bindings prefix `ctrl+j`, next `n`, previous `p` already populated. While disabled, no keystroke SHALL be intercepted and the prefix key SHALL reach the PTY as before this change.

#### Scenario: Default install does not intercept the prefix

- **WHEN** the config has never been changed and the user presses `Ctrl+J` in the terminal
- **THEN** the PTY receives the control character and no pending state is armed

#### Scenario: Enabling activates the default bindings

- **WHEN** the user enables the shortcut without changing any key
- **THEN** `Ctrl+J` then `n` moves to the next tab and `Ctrl+J` then `p` moves to the previous tab
