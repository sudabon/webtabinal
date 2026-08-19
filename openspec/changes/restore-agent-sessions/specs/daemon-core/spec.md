## MODIFIED Requirements

### Requirement: Config file with defaults
The daemon SHALL create `~/Library/Application Support/WebTabinal/config.json` on first launch with documented defaults (port `8642`, shell, scrollback, ring buffer, font_family `Menlo, Monaco, 'Courier New', monospace`, font_size `14`, sidebar width, notification, agent-state detection, agent session restore, confirm_close_running, copy_on_select, quit_when_no_tabs, close_tab_on_clean_exit, tab navigation key bindings defaulting to disabled with prefix `ctrl+j`, next `n`, previous `p`) and load it on subsequent starts. Notification defaults SHALL include `commands=["claude","codex","cursor-agent","agent"]`. Agent-state defaults SHALL be `enabled=true`, `debounce_ms=120`, `quiescence_ms=1500`, `bottom_lines=15`, `notify_on_blocked=true`, `notify_on_idle=false`, and `manifest_dir=""`, where an empty manifest directory resolves to the Application Support default. Restore defaults SHALL be `enabled=true`, `max_sessions=8`, `max_age_hours=72`, and an empty `commands` map, where an empty map resolves to the built-in resume commands and a per-agent entry overrides one of them. A config file written before the key binding, agent-state, notification-command, or restore keys existed SHALL load with those defaults filled in, while an explicitly stored empty command list SHALL be preserved.

#### Scenario: First launch creates config
- **WHEN** the config file does not exist at startup
- **THEN** the daemon writes defaults and continues with those values

#### Scenario: Existing config is respected
- **WHEN** the config file already exists
- **THEN** the daemon uses its values for port, shell, font, agent-state detection, and related settings

#### Scenario: Older config gains key binding defaults
- **WHEN** an existing config file has no key binding keys
- **THEN** the daemon fills in the disabled default bindings and keeps every other stored value

#### Scenario: Older config gains agent-state defaults
- **WHEN** an existing config file has no `state` object or is missing fields within that object
- **THEN** the daemon fills only the missing agent-state defaults and preserves all explicitly stored values, including `enabled=false`

#### Scenario: Older config gains the notification command list
- **WHEN** an existing config file has a `notification` object without `commands`
- **THEN** the daemon fills in `["claude","codex","cursor-agent","agent"]` and preserves every other stored notification value

#### Scenario: Older config defaults screen-derived prompt return to off
- **WHEN** an existing config file has a `state` object without `notify_on_idle`
- **THEN** the daemon fills in `false` and preserves every other stored state value

#### Scenario: Older config gains restore defaults
- **WHEN** an existing config file has no `restore` object or is missing fields within that object
- **THEN** the daemon fills only the missing restore defaults and preserves all explicitly stored values, including `enabled=false`

#### Scenario: Explicit empty command list is preserved
- **WHEN** an existing config file stores `notification.commands` as an empty list
- **THEN** the daemon keeps the empty list rather than restoring the default entries

#### Scenario: Explicit empty resume command is preserved
- **WHEN** an existing config file stores `restore.commands` with `"cursor-agent": ""`
- **THEN** the daemon keeps the empty string rather than restoring the built-in `cursor-agent resume`

#### Scenario: Invalid key binding is rejected on patch
- **WHEN** a config patch sets a prefix without a modifier, or the same key for next and previous
- **THEN** the daemon rejects the patch with an error and the stored config is unchanged

#### Scenario: Invalid agent-state timing is rejected on patch
- **WHEN** a config patch sets debounce outside 20–5000 ms, quiescence outside 0–60000 ms, or bottom lines outside 1–200
- **THEN** the daemon rejects the patch and leaves both stored and runtime agent-state settings unchanged

#### Scenario: Invalid restore limits are rejected on patch
- **WHEN** a config patch sets `restore.max_sessions` outside 1–32 or `restore.max_age_hours` below 0
- **THEN** the daemon rejects the patch and preserves the previous restore settings

#### Scenario: Invalid resume command is rejected on patch
- **WHEN** a config patch sets a `restore.commands` entry that contains a line break, exceeds 512 characters, or uses a blank agent ID as its key
- **THEN** the daemon rejects the patch and preserves the previous command map

#### Scenario: Blank notification command entry is rejected on patch
- **WHEN** a config patch sets `notification.commands` to a list containing an empty or whitespace-only entry
- **THEN** the daemon rejects the patch and preserves the previous list

#### Scenario: Relative manifest directory is rejected
- **WHEN** a config patch sets a non-empty `state.manifest_dir` to a relative path
- **THEN** the daemon rejects the patch and preserves the previous manifest directory
