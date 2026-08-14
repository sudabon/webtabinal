## ADDED Requirements

### Requirement: Notify on agent wait OSC

When the daemon reports an OSC 9 or OSC 99 notify event, the client SHALL raise a desktop notification if notifications are enabled, subject to the same default suppression as command completion: do not notify when the tab is active AND the app window is focused, unless `notification.always` is true. `notification.min_duration_ms` SHALL NOT skip agent-wait notifications. Notification title and body SHALL come from the OSC payload (title MAY fall back to the session command or `WebTabinal`). Click SHALL focus the window and switch to that tab. Sound SHALL NOT play (`sound` key reserved).

#### Scenario: Background wait notifies

- **WHEN** an OSC notify arrives for a non-active tab (or the window is unfocused) and notifications are enabled
- **THEN** a macOS notification is shown with the OSC title and body

#### Scenario: Active focused wait is suppressed by default

- **WHEN** an OSC notify arrives for the active tab while the window is focused and `notification.always` is false
- **THEN** no desktop notification is shown

#### Scenario: Wait ignores min duration

- **WHEN** `notification.min_duration_ms` is 5000 and an OSC notify arrives 1s after the command started
- **THEN** the wait notification is still emitted (subject to focus suppression)

### Requirement: Unread mark on agent wait

A suppressed-or-shown wait notification on a non-active tab SHALL mark that tab unread and increment the Dock badge, using the same clear-on-activate behavior as completion unread marks.

#### Scenario: Background wait marks unread

- **WHEN** an OSC notify arrives for a non-active tab
- **THEN** that tab shows an unread dot and the Dock badge count increases by one if it was not already unread
