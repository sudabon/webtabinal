# desktop-shell Specification

## Purpose
macOS native application shell that starts the WebTabinal daemon when needed and displays the loopback UI in a WKWebView window.
## Requirements
### Requirement: Native app starts daemon then shows UI
The system SHALL provide a macOS application bundle that, on launch, ensures the WebTabinal daemon is listening on loopback and then displays the daemon UI in a native window.

#### Scenario: Cold start launches daemon and window
- **WHEN** the user opens the WebTabinal `.app` and nothing is listening on the configured loopback port
- **THEN** the app starts `webtabinal serve` and opens a window to that URL

#### Scenario: Warm start reuses running daemon
- **WHEN** the user opens the WebTabinal `.app` and the daemon is already listening on the configured loopback port
- **THEN** the app does not start a second daemon and opens a window to the existing URL

#### Scenario: Startup failure is visible
- **WHEN** the app cannot obtain a listening daemon within the startup timeout
- **THEN** it SHALL show an error that points to the daemon log path and SHALL NOT show an empty WebView as if the product were running

### Requirement: Window close does not stop the daemon
Closing the native app window SHALL NOT terminate the daemon or destroy sessions.

#### Scenario: Close window keeps sessions
- **WHEN** the user closes the native app window while sessions exist
- **THEN** the daemon continues running and those sessions remain available on the next launch

### Requirement: App icon matches product favicon
The native app bundle icon SHALL be generated from the same artwork as the web favicon (`icon.svg`).

#### Scenario: Dock icon matches favicon
- **WHEN** the `.app` is installed or run
- **THEN** the Dock / Finder icon is the terminal-chevron artwork used by the web UI, not a placeholder

### Requirement: Edit menu copy and paste

The native app SHALL provide an Edit menu with Copy (⌘C) and Paste (⌘V). These items SHALL perform the same copy and paste operations as the keyboard shortcuts, including the distinction between a focused terminal and a focused text field.

#### Scenario: Edit menu Copy copies terminal selection

- **WHEN** the terminal has a non-empty selection and the user chooses Edit → Copy
- **THEN** that selection is placed on the system clipboard

#### Scenario: Edit menu Paste pastes into the terminal

- **WHEN** the terminal is focused and the user chooses Edit → Paste while the clipboard has text
- **THEN** that text is pasted into the session

### Requirement: Desktop clipboard uses the system pasteboard

Copy and paste in the native app SHALL use the macOS pasteboard so they work even when WKWebView does not expose the web Clipboard API. Paste into the terminal SHALL NOT depend on `navigator.clipboard.readText`.

#### Scenario: Paste works without the web clipboard API

- **WHEN** the user pastes into the terminal in the native app
- **THEN** the text comes from the system pasteboard and is inserted into the session

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

### Requirement: Edit menu toggles the sidebar

The native app's Edit menu SHALL include an item that toggles the left sidebar, invoking the same toggle as the in-app control. Because the shortcut is a two-stroke chord that macOS cannot express as a menu key equivalent, the item SHALL carry no key equivalent. The item SHALL be disabled, or SHALL do nothing, when the web UI has not finished loading.

#### Scenario: Edit menu item collapses the sidebar

- **WHEN** the sidebar is expanded and the user chooses Edit → the sidebar toggle item
- **THEN** the sidebar collapses in the web UI

#### Scenario: Edit menu item expands the sidebar

- **WHEN** the sidebar is collapsed and the user chooses Edit → the sidebar toggle item
- **THEN** the sidebar expands in the web UI

#### Scenario: Item shows no key equivalent

- **WHEN** the user opens the Edit menu
- **THEN** the sidebar toggle item is listed with no keyboard shortcut shown next to it

#### Scenario: Item is inert before the UI loads

- **WHEN** the web UI has not finished loading and the user chooses the sidebar toggle item
- **THEN** the app does not crash and no sidebar change is attempted

