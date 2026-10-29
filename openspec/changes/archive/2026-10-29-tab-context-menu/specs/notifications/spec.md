# Spec Delta

## ADDED Requirements

### Requirement: Per-tab notification mute

Each session SHALL carry a notifications-muted flag, false by default. While a session is muted, the client SHALL NOT raise any desktop notification for that session, regardless of event type (command completion, OSC wait, screen-derived `blocked`, agent turn completion, prompt return) and regardless of `notification.enabled`, `notification.always`, or `notification.commands`.

A muted session's events SHALL still mark the tab unread and update the Dock badge exactly as they would if the banner had been withheld by focus suppression or the command whitelist, so muting silences banners without hiding activity.

Muting SHALL NOT affect other sessions. Unmuting SHALL restore normal notification behavior for subsequent events only; events that occurred while muted SHALL NOT be replayed as notifications.

Restarting an exited session SHALL keep its muted flag on the replacement session. Duplicating a session SHALL create a session that is not muted.

#### Scenario: Muted tab raises no banner on completion

- **WHEN** a muted session running a whitelisted command completes on a non-active tab while notifications are enabled
- **THEN** no platform notification is requested and the tab is marked unread

#### Scenario: Muted tab raises no banner on agent events

- **WHEN** a muted session emits OSC 9, enters `blocked`, or reports turn completion while the tab is not active
- **THEN** no platform notification is requested and the tab is marked unread

#### Scenario: Other tabs keep notifying

- **WHEN** tab A is muted, tab B is not, and an eligible notification event occurs on tab B
- **THEN** a platform notification is requested for tab B

#### Scenario: Unmute does not replay

- **WHEN** a muted session produced an eligible event and the user then unmutes it
- **THEN** no notification is raised for the earlier event, and the next eligible event notifies normally

#### Scenario: Restart keeps mute, duplicate does not

- **WHEN** a muted exited session is restarted and another muted session is duplicated
- **THEN** the restarted session is muted and the duplicate is not muted
