## MODIFIED Requirements

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

## ADDED Requirements

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
