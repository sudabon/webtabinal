## 1. Config schema (Go)

- [x] 1.1 Add `KeyBindingsConfig` (`enabled`, `prefix`, `next_tab`, `prev_tab`) and a `key_bindings` field to `internal/config.Config`
- [x] 1.2 Add defaults to `Defaults()`: disabled, prefix `ctrl+j`, next `n`, prev `p`
- [x] 1.3 Fill empty binding strings in `applyDefaults()` so a config written before this change keeps working
- [x] 1.4 Extend `validate()` to reject: a prefix without a modifier, equal next/prev keys, `escape` in any slot, an unparsable binding string, and a prefix colliding with `meta+1`..`meta+9` / `meta+n` / `meta+c` / `meta+v`
- [x] 1.5 Add Go config tests for defaults, older-config migration, and each rejection case

## 2. Keymap logic (frontend, pure)

- [x] 2.1 Add `web/src/keymap.ts` with the `KeyBindings` type and default bindings
- [x] 2.2 Implement `normalizeKeyEvent`: `ctrl`/`alt`/`shift`/`meta` in fixed order + lowercased base key; return `null` for modifier-only keys and for IME composition (`isComposing` / `keyCode === 229`)
- [x] 2.3 Implement `formatBinding` for display (`ctrl+j` → `Ctrl+J`)
- [x] 2.4 Implement `validateBindings` with the same four rules as the Go validator, returning a reason code per failure
- [x] 2.5 Implement `resolveChordKey(pending, spec, bindings)` returning `none` / `arm` / `next` / `prev` / `cancel`
- [x] 2.6 Implement `neighbourTabIndex(count, activeIndex, direction)` with wrap-around and single/empty-session no-op
- [x] 2.7 Add `web/tests/keymap.test.ts` covering normalization, formatting, every validation rule, the full chord state machine (arm, next, prev, unbound key, Escape, disabled), and wrap-around

## 3. Chord handling in App

- [x] 3.1 Add a `keydown` capture listener in `App` that runs `resolveChordKey` and calls `preventDefault()` + `stopPropagation()` only when the keystroke is consumed
- [x] 3.2 Skip the listener entirely when the shortcut is disabled, when the settings modal or memo editor is open, or when `isTextFieldElement(document.activeElement)` is true
- [x] 3.3 Hold pending state in `App` state and its timeout in a ref; re-arm on prefix, clear on move / cancel / 3s timeout / window `blur` / modal open
- [x] 3.4 Move tabs through the existing `select()` so focus, unread clearing, and WS attach stay on the current path
- [x] 3.5 Render a small pending indicator showing the armed prefix, and style it in `web/src/index.css`
- [x] 3.6 Leave the existing bubble-phase `Cmd+1..9` / `Cmd+N` handler unchanged

## 4. Keyboard settings UI

- [x] 4.1 Add `key_bindings` to `AppConfig` in `web/src/types.ts`
- [x] 4.2 Add a Keyboard category to `SettingsModal`, keeping Appearance as the category selected on open
- [x] 4.3 Add `KeyboardSettings` with an enable toggle, three binding controls showing `formatBinding` values, and a reset-to-defaults control
- [x] 4.4 Implement recording: activating a control captures the next keystroke via a capture listener, consumes it so no shortcut fires, and cancels on `Escape` without closing the modal
- [x] 4.5 Validate a recorded binding with `validateBindings`, persist via `patchConfig({ key_bindings })`, and skip the request when the value is unchanged
- [x] 4.6 On validation failure or patch failure, show the reason and restore the last persisted binding
- [x] 4.7 Wire bindings and the change handler from `App` into `SettingsModal`, keeping local config state in sync with the patch response

## 5. Verify

- [x] 5.1 Add frontend tests for the App chord path: prefix consumed (not forwarded), next/prev select the neighbouring session, unbound key cancels, disabled config forwards the key, modal/text-field open is inert
- [x] 5.2 Add frontend tests for the Keyboard settings pane: current bindings shown, recording persists, invalid binding rolls back with an error, reset restores defaults and keeps the toggle
- [x] 5.3 Run the Go config tests and the frontend tests for the changed files, and confirm the output
- [x] 5.4 Manually confirm with the shortcut enabled: `Ctrl+J` `n` / `p` move and wrap, the terminal accepts typing right after the move, `Ctrl+J` alone then `Escape` leaves the shell unaffected, `Ctrl+J` reaches the PTY while disabled, memo and settings fields still accept `n` / `p`
- [x] 5.5 Update `README.md` with the shortcut, its default-off state, and where to change the bindings
