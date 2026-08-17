## ADDED Requirements

### Requirement: Native macOS notification bridge
The native shell SHALL provide a reply-capable bridge between the main WebTabinal WKWebView frame and `UNUserNotificationCenter` for permission status, permission requests, and notification delivery. The bridge SHALL accept messages only from the main frame served by the configured WebTabinal loopback origin and SHALL validate required fields before invoking the native notification service. The native path SHALL NOT depend on WKWebView Web Notification permission.

#### Scenario: Native permission status is returned
- **WHEN** the main WebTabinal frame requests notification permission status
- **THEN** the bridge maps the current native authorization status to `default`, `granted`, or `denied` and returns it to the client

#### Scenario: Native permission is requested
- **WHEN** the main WebTabinal frame sends a permission request following a user action
- **THEN** the shell requests alert authorization from `UNUserNotificationCenter` and returns the resulting normalized status

#### Scenario: Eligible notification is scheduled
- **WHEN** the main WebTabinal frame sends a valid notification request with session ID, title, and body while native permission is granted
- **THEN** the shell schedules one native notification containing that content and session metadata without requesting sound

#### Scenario: Untrusted frame message is rejected
- **WHEN** a subframe or a frame outside the configured WebTabinal loopback origin sends a notification bridge message
- **THEN** the shell rejects the message and does not query permission or schedule a notification

#### Scenario: Malformed notification is rejected
- **WHEN** a notification bridge message omits the session ID, title, or body or uses invalid field types
- **THEN** the shell returns an error and does not schedule a notification

### Requirement: Native notification presentation and activation
The native shell SHALL register as the user notification center delegate. A notification already approved by the client suppression policy SHALL be eligible for foreground banner/list presentation without sound. Activating the notification SHALL bring WebTabinal to the foreground and deliver its session ID to the Web UI. If the Web UI is not ready, the shell SHALL retain the pending session ID and deliver it once after the initial navigation completes.

#### Scenario: Always notification appears while foregrounded
- **WHEN** the client sends a native notification after `notification.always` allowed it while the WebTabinal window is focused
- **THEN** the native delegate presents the notification as a banner/list without sound

#### Scenario: Activation focuses a loaded app
- **WHEN** the user activates a notification and the Web UI has completed loading
- **THEN** the shell activates the application, raises the main window, and immediately delivers the notification session ID to the Web UI

#### Scenario: Activation waits for initial navigation
- **WHEN** the user activates a notification before the Web UI has completed loading
- **THEN** the shell activates the application, retains the session ID, and delivers it once after navigation completes
