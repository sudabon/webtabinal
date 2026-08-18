## MODIFIED Requirements

### Requirement: Config file with defaults
The daemon SHALL create `~/Library/Application Support/WebTabinal/config.json` on first launch with documented defaults (port `8642`, shell, scrollback, ring buffer, font_family `Menlo, Monaco, 'Courier New', monospace`, font_size `14`, sidebar width, notification, agent-state detection, confirm_close_running, copy_on_select, quit_when_no_tabs, close_tab_on_clean_exit, tab navigation key bindings defaulting to disabled with prefix `ctrl+j`, next `n`, previous `p`) and load it on subsequent starts. Agent-state defaults SHALL be `enabled=true`, `debounce_ms=120`, `quiescence_ms=1500`, `bottom_lines=15`, `notify_on_blocked=true`, and `manifest_dir=""`, where an empty manifest directory resolves to the Application Support default. A config file written before the key binding or agent-state keys existed SHALL load with those defaults filled in.

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

#### Scenario: Invalid key binding is rejected on patch
- **WHEN** a config patch sets a prefix without a modifier, or the same key for next and previous
- **THEN** the daemon rejects the patch with an error and the stored config is unchanged

#### Scenario: Invalid agent-state timing is rejected on patch
- **WHEN** a config patch sets debounce outside 20–5000 ms, quiescence outside 0–60000 ms, or bottom lines outside 1–200
- **THEN** the daemon rejects the patch and leaves both stored and runtime agent-state settings unchanged

#### Scenario: Relative manifest directory is rejected
- **WHEN** a config patch sets a non-empty `state.manifest_dir` to a relative path
- **THEN** the daemon rejects the patch and preserves the previous manifest directory
