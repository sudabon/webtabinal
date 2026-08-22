## ADDED Requirements

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

## MODIFIED Requirements

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
