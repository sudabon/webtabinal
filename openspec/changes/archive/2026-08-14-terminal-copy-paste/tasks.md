## 1. Frontend clipboard facade and shortcuts

- [x] 1.1 Add a small clipboard helper that classifies Cmd+C / Cmd+V vs ignore (text field focused, IME composing, no meta)
- [x] 1.2 Expose a window facade used by both the key handler and desktop `evaluateJavaScript`: focus kind, copy text from terminal or field, paste into the terminal
- [x] 1.3 In `TerminalView`, copy a non-empty xterm selection on Cmd+C via `navigator.clipboard.writeText`; no-op when empty (do not send ETX, do not clear the clipboard)
- [x] 1.4 In `TerminalView`, paste clipboard text on Cmd+V via `term.paste`; skip when a text field is focused
- [x] 1.5 Leave Ctrl+C and `copy_on_select` unchanged

## 2. Desktop Edit menu and pasteboard

- [x] 2.1 Add an Edit menu with Copy (⌘C) and Paste (⌘V)
- [x] 2.2 Copy: evaluate the facade for copy text and write `NSPasteboard` when non-empty
- [x] 2.3 Paste: if a text field is focused, use WKWebView standard paste; otherwise read `NSPasteboard` and call the facade paste (do not use `navigator.clipboard.readText`)
- [x] 2.4 Keep the existing `close` message handler working; if JS needs a pasteboard read fallback, add a dictionary message without breaking the string `close` path

## 3. Verify

- [x] 3.1 Add frontend tests for Cmd+C copy, Cmd+C with no selection, Cmd+V paste, and ignore when a text field is focused
- [x] 3.2 Run frontend tests for the changed files and desktop support tests if pasteboard helpers were extracted
- [x] 3.3 Manually confirm in the browser and in the `.app`: copy/paste in the terminal, Ctrl+C still interrupts, settings/memo fields keep native clipboard
