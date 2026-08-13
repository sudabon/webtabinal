# terminal-ui Specification

## Purpose
TBD - created by archiving change lterm-v01. Update Purpose after archive.
## Requirements
### Requirement: Left sidebar layout without top tab bar
The UI SHALL use a left sidebar (default width 240px, resizable 160–480px, width persisted in config) and a right terminal pane. There SHALL be no top tab bar. A New Tab control SHALL sit at the bottom of the sidebar. `document.title` SHALL be `<dirname> — WebTabinal` for the active session. The default terminal font family SHALL be `Menlo, Monaco, 'Courier New', monospace` (VS Code macOS default) with font size 14.

#### Scenario: Sidebar width persists
- **WHEN** the user drags the sidebar to 320px
- **THEN** the width is saved to config and restored on next load

#### Scenario: Title reflects active directory
- **WHEN** the active session CWD basename is `aiwatch`
- **THEN** `document.title` is `aiwatch — WebTabinal`

### Requirement: Three-row tab presentation
Each tab SHALL show: (1) bold CWD basename (`~` for home), (2) command line (running = live; idle = previous command at 50% opacity; never-run = shell name) with ellipsis and hover tooltip, (3) state indicator (`running` with elapsed time, `idle`, or `exit <code>` with non-zero in red). The active tab SHALL be highlighted. Non-active tabs SHALL show an unread completion dot until opened.

#### Scenario: Idle keeps previous command dimmed
- **WHEN** a session returns to idle after running `go test ./...`
- **THEN** the middle row still shows `go test ./...` at reduced opacity

#### Scenario: Running shows elapsed time
- **WHEN** a session has been running for 83 seconds
- **THEN** the bottom row shows a running indicator including `1:23`

### Requirement: Tab interactions and shortcuts
Click SHALL switch sessions. Drag-and-drop SHALL reorder and commit via the order API. New tab SHALL append at the bottom with CWD `~`. Context menu SHALL offer duplicate, restart (exited only), and close. Keyboard: `Cmd+1..9` switches by order; new tab uses `Cmd+N` (sidebar New Tab remains available if the browser/PWA intercepts the shortcut). Terminal container resize SHALL send WS `resize`. xterm.js SHALL use fit, webgl (canvas fallback), search, web-links; configurable scrollback (default 10000) and font; Japanese IME supported; `copy_on_select` default off; Cmd+C copies when there is a selection.

#### Scenario: Drag reorder commits order
- **WHEN** the user drops a tab to a new position
- **THEN** the client calls the reorder API and the sidebar stays in the new order after refresh

#### Scenario: Cmd number switches tab
- **WHEN** the user presses Cmd+2 and at least two sessions exist
- **THEN** the second session from the top becomes active and attached

### Requirement: Empty state and bootstrap tab
When session count is zero in a non-quit path (or close failed), the UI SHALL show an empty state with a New Tab action. On startup, if there are zero sessions, the client SHALL create one session automatically.

#### Scenario: Startup with zero sessions creates one
- **WHEN** the app loads and the session list is empty
- **THEN** exactly one new session is created and shown

### Requirement: Tab double-click edits memo

Double-clicking a sidebar tab SHALL open the memo editor for that session. Existing click-to-select, drag-and-drop reorder, and context menu actions SHALL remain available.

#### Scenario: Double-click opens memo editor

- **WHEN** the user double-clicks a tab
- **THEN** the memo editor for that session is shown and the tab remains selectable by single click

### Requirement: Tab memo tooltip on hover

A tab with a non-empty memo SHALL show that memo in a delayed tooltip as specified by `tab-memo`. The command-row native tooltip for the truncated command SHALL remain.

#### Scenario: Memo tooltip does not replace command tooltip

- **WHEN** a tab has both a memo and a truncated command line
- **THEN** the delayed memo tooltip can appear on tab hover and the command row may still expose its native title

