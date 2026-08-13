# notifications Specification

## Purpose
TBD - created by archiving change lterm-v01. Update Purpose after archive.
## Requirements
### Requirement: Notify on command completion
When a command completes (`OSC 133;D` or fallback running→idle), the system SHALL raise a desktop notification if notifications are enabled, subject to suppression and duration rules. Default suppression: do not notify when the completing tab is active AND the app window is focused, unless `notification.always` is true. Completions shorter than `notification.min_duration_ms` SHALL be skipped. Notification title SHALL use ✓ or ✗ with the command; body SHALL include directory basename and duration. Click SHALL focus the window and switch to that tab. Sound SHALL NOT play in v0.1 (`sound` key reserved).

#### Scenario: Background completion notifies
- **WHEN** a command completes on a non-active tab (or the window is unfocused) and notifications are enabled
- **THEN** a macOS notification is shown with command and duration

#### Scenario: Active focused completion is suppressed by default
- **WHEN** a command completes on the active tab while the window is focused and `notification.always` is false
- **THEN** no desktop notification is shown

#### Scenario: Short commands respect min duration
- **WHEN** `notification.min_duration_ms` is 5000 and a command finishes in 1s
- **THEN** no notification is emitted for that completion

### Requirement: Dock badge and unread dots
The app SHALL maintain an unread completion count via `navigator.setAppBadge()`. Opening a tab with unread completion SHALL clear that tab’s unread mark and decrement the badge. Permission for notifications SHALL be requested on first PWA launch.

#### Scenario: Badge increments on unread completion
- **WHEN** a non-active tab completes a command
- **THEN** that tab shows an unread dot and the Dock badge count increases by one

#### Scenario: Opening tab clears unread
- **WHEN** the user activates a tab that had an unread completion
- **THEN** the unread dot is removed and the badge count decreases accordingly

