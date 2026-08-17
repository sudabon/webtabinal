## ADDED Requirements

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
