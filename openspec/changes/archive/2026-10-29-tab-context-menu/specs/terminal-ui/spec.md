# Spec Delta

## MODIFIED Requirements

### Requirement: Tab interactions and shortcuts
Click SHALL switch sessions. Drag-and-drop SHALL reorder and commit via the order API. New tab SHALL append at the bottom with CWD `~`. Right-clicking a tab SHALL open the tab context menu specified by "Tab context menu", offering duplicate, restart (exited only), close, and the per-tab notification toggle. Keyboard: `Cmd+1..9` switches by order; new tab uses `Cmd+N` (sidebar New Tab remains available if the browser/PWA intercepts the shortcut); a configurable prefix chord (default `Ctrl+J` then `n` / `p`, disabled by default) moves to the next / previous tab as specified by `keyboard-shortcuts`. Terminal container resize SHALL send WS `resize`. xterm.js SHALL use fit, webgl (canvas fallback), search, web-links, image; configurable scrollback (default 10000) and font; Japanese IME supported; `copy_on_select` default off; Cmd+C copies when there is a selection.

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

## ADDED Requirements

### Requirement: Tab context menu

Right-clicking a sidebar tab SHALL suppress the browser's native context menu and SHALL open an in-page dropdown menu for that tab. The system SHALL NOT use a blocking browser dialog (such as `window.prompt`) to choose a tab action.

The menu's top-left corner SHALL be placed at the pointer position of the right-click, so the menu extends to the right of and below that point. When the menu would overflow the viewport on the right or bottom, it SHALL be shifted (or flipped to the left / above the pointer) so that it stays fully visible.

The menu SHALL list, in this order: duplicate (複製), restart (再起動), close (閉じる), and notifications (通知). Restart SHALL be shown disabled unless the session is exited; activating a disabled item SHALL do nothing and keep the menu open. Choosing duplicate, restart, or close SHALL perform the same action the previous context menu performed for that tab, including the existing confirmation before closing a running tab.

The menu SHALL close when an item is chosen, when the user presses Escape, when the user clicks or right-clicks outside it, when the sidebar scrolls, when the window resizes, or when the window loses focus. At most one tab context menu SHALL be open at a time; right-clicking another tab while a menu is open SHALL replace it with that tab's menu at the new position.

The menu SHALL expose menu semantics to assistive technology and SHALL be operable from the keyboard: when it opens, focus moves to the first enabled item; Arrow Down / Arrow Up move between enabled items; Enter or Space activates the focused item. When the menu closes without changing the active tab, focus SHALL return to where it was before the menu opened.

#### Scenario: Right-click opens dropdown at the pointer

- **WHEN** the user right-clicks a tab at viewport position (x, y) with room to the right and below
- **THEN** no native context menu or browser dialog appears and the tab context menu is shown with its top-left corner at (x, y)

#### Scenario: Menu stays inside the viewport

- **WHEN** the user right-clicks a tab so close to the bottom edge of the window that the menu would extend past it
- **THEN** the menu is repositioned so that all of its items are visible within the viewport

#### Scenario: Menu lists the four items in order

- **WHEN** the tab context menu is open
- **THEN** it shows 複製, 再起動, 閉じる, and 通知 in that order

#### Scenario: Restart is disabled for a live session

- **WHEN** the user opens the menu on a tab whose session is not exited and activates 再起動
- **THEN** nothing happens, the session is not restarted, and the menu stays open

#### Scenario: Restart is enabled for an exited session

- **WHEN** the user opens the menu on an exited tab and chooses 再起動
- **THEN** the session is restarted in the same sidebar position and the menu closes

#### Scenario: Duplicate from the menu

- **WHEN** the user chooses 複製 from a tab's menu
- **THEN** a new session is created in that tab's CWD and the menu closes

#### Scenario: Close a running tab still confirms

- **WHEN** the user chooses 閉じる on a running tab while `confirm_close_running` is true
- **THEN** the existing close confirmation is shown before the session is deleted

#### Scenario: Escape and outside click dismiss the menu

- **WHEN** the menu is open and the user presses Escape or clicks outside the menu
- **THEN** the menu closes and no action is performed

#### Scenario: Keyboard operation

- **WHEN** the menu opens on a live (not exited) tab and the user presses Arrow Down once and then Enter
- **THEN** focus starts on 複製, skips the disabled 再起動, and 閉じる is chosen

### Requirement: Per-tab notification toggle in the context menu

The 通知 item in the tab context menu SHALL be a checkable toggle that reflects whether desktop notifications are enabled for that tab: checked when the tab is not muted, unchecked when it is muted. A newly created tab SHALL start checked. Choosing the item SHALL flip the tab's muted state through the session API, close the menu, and reflect the new state the next time the menu is opened for that tab, including from other connected clients and after a page reload.

The toggle SHALL only affect that one tab. It SHALL NOT change `notification.enabled` or any other global notification setting. When saving the change fails, the tab's previous state SHALL remain in effect and the failure SHALL be reported to the user.

#### Scenario: New tab starts with notifications on

- **WHEN** the user opens the context menu on a newly created tab
- **THEN** 通知 is shown checked

#### Scenario: Turn notifications off for one tab

- **WHEN** the user chooses a checked 通知 item on tab A
- **THEN** the menu closes, tab A becomes muted, and reopening tab A's menu shows 通知 unchecked while other tabs' 通知 items are unchanged

#### Scenario: Turn notifications back on

- **WHEN** the user chooses an unchecked 通知 item on a muted tab
- **THEN** the tab is no longer muted and reopening its menu shows 通知 checked

#### Scenario: Muted state survives reload

- **WHEN** the user mutes a tab and reloads the page
- **THEN** that tab's menu still shows 通知 unchecked
