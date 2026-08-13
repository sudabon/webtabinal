## 1. Backend config

- [x] 1.1 Add `ColorScheme` (`light` | `dark` | `system`) to `internal/config.Config` with default `system`
- [x] 1.2 Validate `color_scheme` on patch; reject invalid values
- [x] 1.3 Extend config tests for default, valid patch, and invalid rejection

## 2. Theme tokens and resolution

- [x] 2.1 Add light/dark CSS variables and `data-theme` support in `index.css`; move hardcoded chrome colors onto tokens
- [x] 2.2 Add frontend `color_scheme` to `AppConfig` type and any test fixtures
- [x] 2.3 Implement theme resolution helper/hook (`light`/`dark`/`system` + `prefers-color-scheme` listener) that sets `data-theme` on the document
- [x] 2.4 Wire theme application in `App` from loaded config

## 3. Terminal theme sync

- [x] 3.1 Map resolved theme to xterm theme colors in `TerminalView`
- [x] 3.2 Update xterm theme when resolved theme changes after mount

## 4. Settings UI

- [x] 4.1 Add Settings control below New Tab in `Sidebar`
- [x] 4.2 Build `SettingsModal` shell (left nav, right pane, cancel, Esc, backdrop close)
- [x] 4.3 Add Appearance pane with Light / Dark / Auto controls
- [x] 4.4 On change, `patchConfig({ color_scheme })` immediately; rollback + toast on failure
- [x] 4.5 Connect open/close state from `App` to Sidebar + SettingsModal

## 5. Verify

- [x] 5.1 Run Go config tests and frontend checks relevant to changed files
- [x] 5.2 Manually verify light/dark/system, OS preference change while system, and modal open/close paths
