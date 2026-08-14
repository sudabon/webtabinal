## MODIFIED Requirements

### Requirement: Tab interactions and shortcuts
Click SHALL switch sessions. Drag-and-drop SHALL reorder and commit via the order API. New tab SHALL append at the bottom with CWD `~`. Context menu SHALL offer duplicate, restart (exited only), and close. Keyboard: `Cmd+1..9` switches by order; new tab uses `Cmd+N` (sidebar New Tab remains available if the browser/PWA intercepts the shortcut); a configurable prefix chord (default `Ctrl+J` then `n` / `p`, disabled by default) moves to the next / previous tab as specified by `keyboard-shortcuts`. Terminal container resize SHALL send WS `resize`. xterm.js SHALL use fit, webgl (canvas fallback), search, web-links; configurable scrollback (default 10000) and font; Japanese IME supported; `copy_on_select` default off; Cmd+C copies when there is a selection.

#### Scenario: Drag reorder commits order
- **WHEN** the user drops a tab to a new position
- **THEN** the client calls the reorder API and the sidebar stays in the new order after refresh

#### Scenario: Cmd number switches tab
- **WHEN** the user presses Cmd+2 and at least two sessions exist
- **THEN** the second session from the top becomes active and attached

#### Scenario: Prefix chord switches to the neighbouring tab
- **WHEN** the tab navigation shortcut is enabled and the user presses the prefix key then the next-tab key
- **THEN** the session below the active one in sidebar order becomes active and attached, and neither keystroke is written to the PTY

### Requirement: Focus the terminal after tab select

After the user selects a session to work in, the UI SHALL move keyboard focus to the active terminal so keystrokes go to the shell without an extra click on the terminal pane. This SHALL apply to sidebar tab click (including clicking the already-active tab), `Cmd+1`..`9` session switch, the tab navigation prefix chord, and new tab creation.

#### Scenario: Clicking a tab focuses the shell

- **WHEN** the user clicks a sidebar tab for a session
- **THEN** that session is active and the terminal accepts keyboard input without a further click on the terminal pane

#### Scenario: Clicking the active tab still focuses the shell

- **WHEN** the already-active tab is clicked
- **THEN** the terminal accepts keyboard input without a further click on the terminal pane

#### Scenario: Cmd-number switch focuses the shell

- **WHEN** the user presses Cmd+2 and at least two sessions exist
- **THEN** the second session from the top becomes active and the terminal accepts keyboard input without a further click on the terminal pane

#### Scenario: Prefix chord switch focuses the shell

- **WHEN** the user completes the tab navigation chord and at least two sessions exist
- **THEN** the newly selected session is active and the terminal accepts keyboard input without a further click on the terminal pane

#### Scenario: New tab focuses the shell

- **WHEN** the user creates a new tab
- **THEN** the new session is active and the terminal accepts keyboard input without a further click on the terminal pane

### Requirement: Modals keep focus when open

While the settings modal or tab memo editor is open, selecting or showing a session SHALL NOT steal keyboard focus from that modal's controls. The tab navigation prefix chord SHALL be inactive while either modal is open, so its keystrokes reach the modal's controls.

#### Scenario: Memo editor keeps the input focused

- **WHEN** the user double-clicks a tab to edit its memo
- **THEN** the memo editor input remains focused and keystrokes go to the memo, not the PTY

#### Scenario: Settings modal keeps its focus

- **WHEN** the settings modal is open
- **THEN** the terminal does not take keyboard focus away from the modal

#### Scenario: Prefix key types into a modal field

- **WHEN** the tab memo editor is open and the user presses the prefix key while its input is focused
- **THEN** the keystroke is handled by the input and no pending prefix state is armed
