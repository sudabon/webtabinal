## 1. Settings category and shell field

- [x] 1.1 Add a General category to `SettingsModal` left nav; keep Appearance as the category selected on open
- [x] 1.2 Add `GeneralSettings` with an absolute-path text field bound to `config.shell`, placeholder examples `/bin/zsh` and `/bin/bash`, and a short hint that the value applies to new tabs
- [x] 1.3 Commit on blur or Enter via `patchConfig({ shell })`; skip the request when the value equals the last persisted shell
- [x] 1.4 On patch failure, restore the last persisted value and surface the existing action-error toast
- [x] 1.5 Style the text field to match the settings modal (do not reuse the appearance radio cards)

## 2. App wiring

- [x] 2.1 Pass `shell` and the commit handler from `App` into `SettingsModal`
- [x] 2.2 Keep local config state in sync with a successful patch response

## 3. Verify

- [x] 3.1 Add frontend tests for showing the current shell, committing a new path, skipping unchanged blur, and rolling back on patch failure
- [x] 3.2 Run existing Go config tests (invalid relative / missing / non-executable shell) and frontend tests for the changed files
- [x] 3.3 Manually confirm: set `/bin/bash`, open a new tab (bash), leave an old zsh tab running, reject a bad path with rollback
