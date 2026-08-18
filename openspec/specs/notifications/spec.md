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
The app SHALL maintain an unread completion count via `navigator.setAppBadge()` when that API is available. Opening a tab with unread completion SHALL clear that tab’s unread mark and decrement the badge. Notification permission SHALL NOT be requested automatically during page load; authorization SHALL follow the user-initiated notification authorization requirement.

#### Scenario: Badge increments on unread completion
- **WHEN** a non-active tab completes a command
- **THEN** that tab shows an unread dot and the Dock badge count increases by one

#### Scenario: Opening tab clears unread
- **WHEN** the user activates a tab that had an unread completion
- **THEN** the unread dot is removed and the badge count decreases accordingly

#### Scenario: Initial load does not prompt for notifications
- **WHEN** the native app, PWA, or browser page loads while notification permission is undetermined
- **THEN** the system does not request notification permission until the user activates the permission control

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

### Requirement: Platform-specific notification delivery
After an event passes the existing notification enablement, focus suppression, and duration rules, the client SHALL use exactly one notification provider for the current environment. The macOS native app SHALL send the notification to the native desktop bridge and SHALL NOT invoke the Web Notification API. A browser or PWA SHALL use the Web Notification API only when its permission is granted. Failure or lack of permission SHALL NOT prevent the existing unread-tab behavior.

#### Scenario: Native app uses only the native provider
- **WHEN** an eligible command-completion or agent-wait event occurs in the macOS native app
- **THEN** the client sends one native notification request containing the session ID, title, and body and does not construct a Web Notification

#### Scenario: PWA uses the web provider
- **WHEN** an eligible event occurs in a PWA with Web Notification permission granted
- **THEN** the client constructs one Web Notification containing the event title and body

#### Scenario: Missing permission keeps unread state
- **WHEN** an eligible event occurs for a non-active tab while notification permission is not granted
- **THEN** no OS notification is requested and the tab is still marked unread

### Requirement: User-initiated notification authorization
The client SHALL expose notification authorization as `default`, `granted`, `denied`, or `unsupported`. It SHALL request authorization only as the direct result of the user activating a notification permission control. The native app SHALL obtain this state through the desktop bridge; a browser or PWA SHALL obtain it from the Web Notification API.

#### Scenario: User grants native notification permission
- **WHEN** native authorization is `default` and the user activates the notification permission control
- **THEN** the client asks the native bridge to request permission and updates the displayed state with the returned result

#### Scenario: User grants browser notification permission
- **WHEN** browser notification permission is `default` and the user activates the notification permission control
- **THEN** `Notification.requestPermission()` is called from that activation and the displayed state is updated with the returned result

#### Scenario: Denied permission is not re-prompted
- **WHEN** authorization is `denied`
- **THEN** the client explains that permission must be changed in the operating system or browser settings and does not repeatedly request permission

#### Scenario: Unsupported environment is explicit
- **WHEN** neither the native notification bridge nor the Web Notification API is available
- **THEN** the client reports notification authorization as `unsupported` and does not offer a permission request action

### Requirement: Notification activation selects its session
Activating an OS notification SHALL focus the WebTabinal window and select the session identified by the notification. Selection SHALL use the same client path as direct tab activation so that the unread mark is cleared and terminal focus is restored.

#### Scenario: Native notification click selects a background session
- **WHEN** the user activates a native notification for a non-active session while the app is running
- **THEN** WebTabinal comes to the foreground, selects that session, clears its unread mark, and focuses its terminal

#### Scenario: Web notification click selects a background session
- **WHEN** the user activates a Web Notification for a non-active session
- **THEN** the page is focused and the client selects that session through the same tab-selection path

### Requirement: Notify on agent blocked transition

When agent state changes from any non-blocked state to `blocked`, the system SHALL create an agent-attention notification event if `state.notify_on_blocked` and `notification.enabled` are true. The event SHALL use the existing platform notification provider and unread-mark behavior, SHALL obey `notification.always`, and SHALL NOT be suppressed by `notification.min_duration_ms`.

#### Scenario: Background blocked state notifies
- **WHEN** a background session changes from `working` to `blocked` with blocked notifications enabled
- **THEN** the session is marked unread and one platform notification is requested

#### Scenario: Active focused blocked state respects always
- **WHEN** the active session becomes blocked while the window is focused and `notification.always` is false
- **THEN** the state pill updates but no platform banner is requested

#### Scenario: Always allows foreground blocked notification
- **WHEN** the active focused session becomes blocked and `notification.always` is true
- **THEN** one platform notification is requested

#### Scenario: Blocked ignores command duration threshold
- **WHEN** `notification.min_duration_ms` is greater than zero and an agent becomes blocked immediately after starting
- **THEN** the blocked notification remains eligible because it is an attention event rather than command completion

#### Scenario: Repeated blocked evidence does not notify again
- **WHEN** detector evaluations repeatedly confirm a session that is already `blocked`
- **THEN** no additional blocked notification event is created until the session leaves and later re-enters `blocked`

#### Scenario: Blocked notifications can be disabled independently
- **WHEN** `state.notify_on_blocked` is false and agent state changes to `blocked`
- **THEN** the pill and state transport update but no screen-derived notification event is created

### Requirement: Agent attention notifications are deduplicated across signals

The daemon SHALL deduplicate OSC 9, OSC 99, OSC 777, and screen-derived blocked notification events by session within a four-second monotonic window. The first eligible event SHALL be emitted immediately; later events in that window SHALL suppress only duplicate notification delivery and SHALL NOT suppress state transitions.

#### Scenario: OSC arrives before screen detection
- **WHEN** an OSC wait event is emitted and the same session enters screen-detected `blocked` two seconds later
- **THEN** only the OSC-origin notification is delivered while the blocked state transition is still broadcast

#### Scenario: Screen detection arrives before OSC
- **WHEN** a screen-derived blocked event is emitted and the same session sends OSC 9 one second later
- **THEN** only the screen-origin notification is delivered

#### Scenario: Different sessions are independent
- **WHEN** two sessions each produce an agent-attention event within four seconds
- **THEN** each session can deliver one notification

#### Scenario: Later attention event can notify
- **WHEN** a session produces another eligible agent-attention event after the four-second window
- **THEN** the later event is not suppressed by the earlier timestamp

### Requirement: Disabling state detection preserves OSC notifications

When `state.enabled` changes to false, the system SHALL stop screen-derived state evaluation and blocked notifications, reset live agent states to `none`, and continue parsing and delivering existing OSC notifications.

#### Scenario: Disable clears a visible state
- **WHEN** state detection is disabled while a session is `blocked`
- **THEN** clients receive an agent state update to `none` and no further screen-derived blocked notifications occur

#### Scenario: OSC remains active while detection is disabled
- **WHEN** a session emits OSC 9 while `state.enabled` is false and notifications are otherwise eligible
- **THEN** the existing OSC wait notification is still delivered

#### Scenario: Re-enable evaluates live sessions
- **WHEN** state detection is re-enabled while sessions remain live
- **THEN** the daemon evaluates their current observations and broadcasts any newly detected agent states

