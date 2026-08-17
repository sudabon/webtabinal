## 1. Web notification provider

- [x] 1.1 Add a typed notification provider module with normalized `default` / `granted` / `denied` / `unsupported` permission states and mutually exclusive native and Web Notification implementations
- [x] 1.2 Move command-completion and agent-wait banner creation behind the common provider while preserving existing enabled, always, duration, unread-dot, and badge behavior
- [x] 1.3 Remove the page-load `Notification.requestPermission()` call and expose provider permission query/request operations that are safe to call from the settings UI
- [x] 1.4 Add a fixed native activation event handler that routes a session ID through the existing tab-selection path, including unread clearing and terminal focus
- [x] 1.5 Add frontend tests proving native delivery never constructs a Web Notification, web delivery requires granted permission, missing permission preserves unread state, and native activation selects the session

## 2. Native macOS notification service and bridge

- [x] 2.1 Add UserNotifications to the desktop build/test linkage and introduce an injectable native notification service that maps all `UNAuthorizationStatus` values to the shared permission states
- [x] 2.2 Register a dedicated `WKScriptMessageHandlerWithReply` and implement `getPermission`, `requestPermission`, and `show` operations with main-frame, configured-loopback-origin, type, and required-field validation
- [x] 2.3 Schedule unique `UNNotificationRequest` values containing title, body, and session metadata with no sound, and return deterministic success/error replies to JavaScript
- [x] 2.4 Register `UNUserNotificationCenterDelegate` foreground presentation and notification-response handling so an eligible always-notify banner is shown and the app/window is activated on click
- [x] 2.5 Deliver clicked session IDs to the fixed Web UI activation event, retaining and delivering the final pending ID once when navigation has not completed
- [x] 2.6 Extend Swift tests with fake notification-center coverage for status mapping, authorization, request content, origin/message rejection, foreground options, and pending activation delivery

## 3. Notification settings UI

- [x] 3.1 Add a Notifications category to the settings modal without changing Appearance as the initial category
- [x] 3.2 Add accessible controls for `notification.enabled` and `notification.always`, persist nested config patches immediately, and roll back with a visible error on failure
- [x] 3.3 Show the normalized platform permission state, offer the permission action only for `default`, and show accurate recovery guidance for `denied` and `unsupported`
- [x] 3.4 Refresh permission when the Notifications category opens and when the window regains focus, without triggering a permission request automatically
- [x] 3.5 Add settings tests for category navigation, immediate persistence/rollback, direct-click permission request, status rendering, and external permission refresh

## 4. Agent integration documentation and diagnostics

- [x] 4.1 Update the Codex example to explicitly enable turn-complete/approval notifications, force `osc9`, explain `notification_condition`, and distinguish it from WebTabinal's `notification.always`
- [x] 4.2 Add Claude Code `Stop` hook guidance for immediate turn completion plus `PermissionRequest` and `Notification` hook guidance for approval and idle prompts, all writing OSC 9 to `/dev/tty`
- [x] 4.3 Verify the installed cursor-agent notification output end to end in WebTabinal; document the verified behavior/version or clearly mark OSC delivery unsupported without adding a BEL/process heuristic
- [x] 4.4 Add a standalone OSC 9 probe and a troubleshooting matrix that separates agent emission, WebTabinal permission, app focus suppression, and macOS/browser permission failures

## 5. Verification

- [x] 5.1 Run OSC parser, server, session, config, and full Go test suites to confirm the daemon and WebSocket contracts remain unchanged
- [x] 5.2 Run all frontend tests, type/build checks, and production Vite build
- [x] 5.3 Run desktop support tests and build/sign the macOS application bundle with the UserNotifications framework
- [x] 5.4 From `/Applications/WebTabinal.app`, manually verify first-time permission, denied-state guidance, background notification, `notification.always` foreground presentation, notification click routing, and absence of duplicate Web Notifications
- [x] 5.5 Exercise the documented Codex and Claude Code completion/wait flows and record the cursor-agent verification result in the README
