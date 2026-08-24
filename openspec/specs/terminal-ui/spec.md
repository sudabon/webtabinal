# terminal-ui Specification

## Purpose
TBD - created by archiving change lterm-v01. Update Purpose after archive.
## Requirements
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

### Requirement: Three-row tab presentation
Each tab SHALL show: (1) bold CWD basename (`~` for home), (2) command line (running = live; idle = previous command at 50% opacity; never-run = shell name) with ellipsis and hover tooltip, (3) state indicator (`running` with elapsed time, `idle`, or `exit <code>` with non-zero in red). The active tab SHALL be highlighted. Non-active tabs SHALL show an unread completion dot until opened.

#### Scenario: Idle keeps previous command dimmed
- **WHEN** a session returns to idle after running `go test ./...`
- **THEN** the middle row still shows `go test ./...` at reduced opacity

#### Scenario: Running shows elapsed time
- **WHEN** a session has been running for 83 seconds
- **THEN** the bottom row shows a running indicator including `1:23`

### Requirement: Tab interactions and shortcuts
Click SHALL switch sessions. Drag-and-drop SHALL reorder and commit via the order API. New tab SHALL append at the bottom with CWD `~`. Context menu SHALL offer duplicate, restart (exited only), and close. Keyboard: `Cmd+1..9` switches by order; new tab uses `Cmd+N` (sidebar New Tab remains available if the browser/PWA intercepts the shortcut); a configurable prefix chord (default `Ctrl+J` then `n` / `p`, disabled by default) moves to the next / previous tab as specified by `keyboard-shortcuts`. Terminal container resize SHALL send WS `resize`. xterm.js SHALL use fit, webgl (canvas fallback), search, web-links, image; configurable scrollback (default 10000) and font; Japanese IME supported; `copy_on_select` default off; Cmd+C copies when there is a selection.

#### Scenario: Drag reorder commits order
- **WHEN** the user drops a tab to a new position
- **THEN** the client calls the reorder API and the sidebar stays in the new order after refresh

#### Scenario: Cmd number switches tab
- **WHEN** the user presses Cmd+2 and at least two sessions exist
- **THEN** the second session from the top becomes active and attached

#### Scenario: Prefix chord switches to the neighbouring tab
- **WHEN** the tab navigation shortcut is enabled and the user presses the prefix key then the next-tab key
- **THEN** the session below the active one in sidebar order becomes active and attached, and neither keystroke is written to the PTY

#### Scenario: Image addon is loaded with the other addons
- **WHEN** a terminal view is created
- **THEN** the image addon is loaded together with fit, search, and web-links

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

### Requirement: Copy selection with Cmd+C

When the terminal is focused, Cmd+C SHALL copy the current xterm selection to the clipboard if the selection is non-empty. Cmd+C SHALL NOT send an interrupt to the PTY. Ctrl+C SHALL continue to send interrupt as today.

#### Scenario: Cmd+C copies a selection

- **WHEN** the terminal has a non-empty selection and the user presses Cmd+C
- **THEN** that text is placed on the clipboard and the PTY does not receive ETX

#### Scenario: Cmd+C with no selection is a no-op

- **WHEN** the terminal has no selection and the user presses Cmd+C
- **THEN** the clipboard is left unchanged and the PTY does not receive ETX

#### Scenario: Ctrl+C still interrupts

- **WHEN** the user presses Ctrl+C while the terminal is focused
- **THEN** the session receives interrupt (ETX) as before this change

### Requirement: Paste with Cmd+V

When the terminal is focused, Cmd+V SHALL paste the clipboard text into the session as terminal input.

#### Scenario: Cmd+V pastes into the terminal

- **WHEN** the clipboard contains text and the user presses Cmd+V while the terminal is focused
- **THEN** that text is written to the session as if pasted in a native terminal

### Requirement: Text fields keep native clipboard shortcuts

Copy and paste shortcuts SHALL NOT be intercepted when a normal text field (settings, memo, or similar) is focused.

#### Scenario: Settings field uses native copy

- **WHEN** a settings text input is focused and the user presses Cmd+C with selected field text
- **THEN** that field text is copied and the terminal selection is not used

#### Scenario: Memo field uses native paste

- **WHEN** the tab memo input is focused and the user presses Cmd+V
- **THEN** the clipboard text is inserted into the memo field, not the PTY

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

### Requirement: Sidebar agent state pills

Each sidebar tab SHALL display a separate agent state pill when `agent_state` is `idle`, `working`, or `blocked`, and SHALL omit the pill when the state is `none`. The pill SHALL identify the agent and state with text or an accessible name, SHALL use a muted idle treatment, an activity indicator for working, and a non-color-only attention treatment for blocked.

#### Scenario: Working agent is visible
- **WHEN** a Codex session has agent state `working`
- **THEN** its tab shows a Codex working pill with an activity indicator

#### Scenario: Blocked state is not color only
- **WHEN** a Claude Code session has agent state `blocked`
- **THEN** its tab exposes both a visible or accessible blocked label and an attention color

#### Scenario: Ordinary shell has no pill
- **WHEN** a session has agent state `none`
- **THEN** no agent state pill occupies space in its tab

### Requirement: Agent state coexists with existing tab information

The agent state pill SHALL NOT replace the tab's CWD, command, shell state, elapsed time, exit status, integration indicator, memo interaction, or unread completion mark. Agent state changes SHALL NOT reorder tabs or alter Cmd+number navigation order.

#### Scenario: Shell running and agent blocked are both shown
- **WHEN** a tab has shell state `running` and agent state `blocked`
- **THEN** the tab continues to show its running shell status and separately shows the blocked agent pill

#### Scenario: Unread survives blocked resolution
- **WHEN** a background blocked notification marks a tab unread and the agent later becomes `idle`
- **THEN** the unread mark remains until the user opens that tab while the pill updates to idle

#### Scenario: Blocked transition preserves order
- **WHEN** a lower tab changes to `blocked`
- **THEN** it remains in its daemon-authoritative position and existing drag and keyboard navigation order is unchanged

### Requirement: Agent state motion respects accessibility preferences

Working-state motion SHALL animate only compositor-friendly properties and SHALL stop when `prefers-reduced-motion: reduce` is active. Blocked state SHALL NOT use continuous flashing.

#### Scenario: Reduced motion disables the spinner
- **WHEN** the operating system requests reduced motion and an agent is working
- **THEN** the tab shows a static working indicator with the same accessible state label

#### Scenario: Blocked state does not flash
- **WHEN** an agent remains blocked
- **THEN** its attention treatment remains readable without a continuous flashing animation

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

### Requirement: Terminal image protocol rendering

The terminal SHALL render inline images transmitted by programs over the kitty graphics protocol, Sixel, and the iTerm2 inline image protocol (IIP). Image handling SHALL be provided by the official `@xterm/addon-image`, loaded alongside the existing xterm.js addons; the client SHALL NOT carry its own implementation of any image protocol.

For the kitty graphics protocol the terminal SHALL, at minimum:

- answer a capability query (`a=q`) for the direct transmission medium (`t=d`) with `OK` when the payload is valid, so that programs probing for image support detect the terminal as capable
- reject a capability query for a transmission medium the client cannot read — shared memory (`t=s`) and file (`t=f`) — with an error response, so that the sending program falls back to direct transmission rather than handing over a path the browser cannot open
- accept transmit-and-display (`a=T`) of RGB (`f=24`) and RGBA (`f=32`) pixel data, zlib-compressed (`o=z`) and split across chunks (`m=1` … `m=0`)
- honour `C=1` by leaving the cursor where it was before the image was placed
- honour delete requests for all images (`d=A`) and for a single image id (`d=I`)

The terminal SHALL report its pixel geometry so that programs can size images: window size in pixels (`CSI 14 t`), cell size in pixels (`CSI 16 t`), and window size in cells (`CSI 18 t`).

The daemon SHALL continue to forward PTY bytes unchanged; image sequences SHALL NOT be parsed, rewritten, or stripped on the server side.

#### Scenario: Capability probe reports image support

- **WHEN** a program writes `ESC _ G i=<id>,a=q,t=d,f=24,s=1,v=1;<base64 of 3 bytes> ESC \` to the PTY
- **THEN** the terminal replies `ESC _ G i=<id>;OK ESC \`

#### Scenario: Unreadable transmission medium is rejected

- **WHEN** a program queries the shared-memory (`t=s`) or file (`t=f`) transmission medium
- **THEN** the terminal replies with an error response rather than `OK`, and the program falls back to direct transmission

#### Scenario: Chunked compressed frame is displayed

- **WHEN** a program transmits an RGBA image with `a=T,f=32,o=z,t=d` split into several `m=1` chunks terminated by an `m=0` chunk
- **THEN** the image is decompressed and drawn in the terminal

#### Scenario: Cursor stays put when C=1 is set

- **WHEN** an image is displayed with `C=1`
- **THEN** the cursor remains at the position it held before the image was placed

#### Scenario: Delete-all clears displayed images

- **WHEN** a program sends `a=d,d=A`
- **THEN** every displayed image is removed from the screen

#### Scenario: Pixel geometry is reported

- **WHEN** a program writes `CSI 14 t`
- **THEN** the terminal replies with its window size in pixels

#### Scenario: terminal-browser starts without the unsupported-terminal error

- **WHEN** the user runs terminal-code or terminal-browser in a WebTabinal session
- **THEN** the program does not print `This terminal cannot show images, which terminal-browser needs.` and proceeds to render its UI


### Requirement: Attach an image to the agent's prompt

Coding agents read an image from a filesystem path, so the terminal SHALL turn a pasted or dropped image into a stored file and type that file's path into the session as terminal input, the way a native terminal inserts a dropped file's path. Paths SHALL be backslash-escaped for the characters a shell would otherwise treat as separators, and SHALL be followed by a trailing space. Several images attached at once SHALL be typed as one space-separated run.

Cmd+V SHALL attach an image when the clipboard holds one and SHALL keep pasting text otherwise. Dropping files on the terminal SHALL attach the images among them and ignore the rest. Ctrl+V SHALL continue to reach the PTY untouched, so an agent that reads the native clipboard itself keeps working.

#### Scenario: Dropped image is typed as a path

- **WHEN** the user drops a PNG on the terminal
- **THEN** the file is stored and its escaped path, followed by a space, is written to the session

#### Scenario: Cmd+V with an image on the clipboard attaches it

- **WHEN** the clipboard holds an image and the user presses Cmd+V while the terminal is focused
- **THEN** the image is attached as a path instead of the paste being a no-op

#### Scenario: Cmd+V with text still pastes text

- **WHEN** the clipboard holds no image and the user presses Cmd+V
- **THEN** the clipboard text is written to the session as before

#### Scenario: Dropped non-image files are ignored

- **WHEN** the user drops a text file on the terminal
- **THEN** nothing is uploaded and nothing is typed

#### Scenario: A failed upload types nothing

- **WHEN** storing a dropped image fails
- **THEN** no path is typed for it and the remaining images are still attached

#### Scenario: A drag that carries no files is left alone

- **WHEN** a tab-reorder drag passes over the terminal
- **THEN** the terminal does not claim the drop and shows no drop target

#### Scenario: A file dropped outside the terminal does not navigate

- **WHEN** the user drops a file anywhere else in the window
- **THEN** the browser does not leave the app to display that file
