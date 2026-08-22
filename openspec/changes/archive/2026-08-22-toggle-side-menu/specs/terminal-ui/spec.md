## ADDED Requirements

### Requirement: Sidebar collapse and expand

The UI SHALL let the user collapse the left sidebar and expand it again. While collapsed, the sidebar and its resizer SHALL NOT occupy horizontal space and the terminal pane SHALL fill the freed width. Collapsing and expanding SHALL resize the terminal so the shell sees the new column count.

#### Scenario: Collapsing widens the terminal

- **WHEN** the sidebar is expanded at 240px and the user collapses it
- **THEN** the sidebar is no longer laid out, the terminal pane occupies the full window width, and a `resize` is sent for the active session

#### Scenario: Expanding restores the previous width

- **WHEN** the sidebar was collapsed after being resized to 320px and the user expands it
- **THEN** the sidebar is shown again at 320px

#### Scenario: Collapsed sidebar hides the tab list

- **WHEN** the sidebar is collapsed
- **THEN** no session tab, New Tab control, or settings control from the sidebar is visible

### Requirement: Sidebar collapse is reachable without the keyboard

The UI SHALL provide a pointer-operable collapse control while the sidebar is expanded and a pointer-operable expand control while it is collapsed. The expand control SHALL remain visible over the terminal pane so a collapsed sidebar can always be restored without the keyboard shortcut, which is disabled by default. Both controls SHALL carry an accessible name identifying the action.

#### Scenario: Collapse control is present when expanded

- **WHEN** the sidebar is expanded
- **THEN** a control that collapses the sidebar is visible and activating it collapses the sidebar

#### Scenario: Expand control is present when collapsed

- **WHEN** the sidebar is collapsed and the keyboard shortcut is disabled
- **THEN** a control that expands the sidebar is visible over the terminal pane and activating it expands the sidebar

### Requirement: Collapsed state is not persisted

The collapsed or expanded state of the sidebar SHALL live only in the running UI. It SHALL NOT be written to the daemon config, and a reload or a daemon restart SHALL show the sidebar expanded. The persisted sidebar width SHALL be unaffected by collapsing.

#### Scenario: Reload shows the sidebar expanded

- **WHEN** the user collapses the sidebar and then reloads the UI
- **THEN** the sidebar is expanded

#### Scenario: Collapsing does not overwrite the stored width

- **WHEN** the user resizes the sidebar to 320px, collapses it, and reloads
- **THEN** the sidebar is expanded at 320px

## MODIFIED Requirements

### Requirement: Left sidebar layout without top tab bar
The UI SHALL use a left sidebar (default width 240px, resizable 160–480px, width persisted in config, collapsible) and a right terminal pane. There SHALL be no top tab bar. A New Tab control SHALL sit at the bottom of the sidebar. `document.title` SHALL be `<dirname> — WebTabinal` for the active session. The default terminal font family SHALL be `Menlo, Monaco, 'Courier New', monospace` (VS Code macOS default) with font size 14.

#### Scenario: Sidebar width persists
- **WHEN** the user drags the sidebar to 320px
- **THEN** the width is saved to config and restored on next load

#### Scenario: Title reflects active directory
- **WHEN** the active session CWD basename is `aiwatch`
- **THEN** `document.title` is `aiwatch — WebTabinal`

#### Scenario: Title is unaffected by collapsing
- **WHEN** the sidebar is collapsed
- **THEN** `document.title` still names the active session directory

### Requirement: Tab interactions and shortcuts
Click SHALL switch sessions. Drag-and-drop SHALL reorder and commit via the order API. New tab SHALL append at the bottom with CWD `~`. Context menu SHALL offer duplicate, restart (exited only), and close. Keyboard: `Cmd+1..9` switches by order; new tab uses `Cmd+N` (sidebar New Tab remains available if the browser/PWA intercepts the shortcut); a configurable prefix chord (default `Ctrl+J` then `n` / `p` / `j`, disabled by default) moves to the next / previous tab or toggles the sidebar as specified by `keyboard-shortcuts`. Terminal container resize SHALL send WS `resize`. xterm.js SHALL use fit, webgl (canvas fallback), search, web-links; configurable scrollback (default 10000) and font; Japanese IME supported; `copy_on_select` default off; Cmd+C copies when there is a selection.

#### Scenario: Drag reorder commits order
- **WHEN** the user drops a tab to a new position
- **THEN** the client calls the reorder API and the sidebar stays in the new order after refresh

#### Scenario: Cmd number switches tab
- **WHEN** the user presses Cmd+2 and at least two sessions exist
- **THEN** the second session from the top becomes active and attached

#### Scenario: Prefix chord switches to the neighbouring tab
- **WHEN** the tab navigation shortcut is enabled and the user presses the prefix key then the next-tab key
- **THEN** the session below the active one in sidebar order becomes active and attached, and neither keystroke is written to the PTY

#### Scenario: Prefix chord toggles the sidebar
- **WHEN** the shortcut is enabled and the user presses the prefix key then the toggle-sidebar key
- **THEN** the sidebar collapses or expands and neither keystroke is written to the PTY

#### Scenario: Cmd number still works with the sidebar collapsed
- **WHEN** the sidebar is collapsed and the user presses Cmd+2 with at least two sessions
- **THEN** the second session in order becomes active and attached
