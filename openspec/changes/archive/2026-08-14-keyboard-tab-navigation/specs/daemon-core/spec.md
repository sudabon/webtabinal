## MODIFIED Requirements

### Requirement: Config file with defaults
The daemon SHALL create `~/Library/Application Support/WebTabinal/config.json` on first launch with documented defaults (port `8642`, shell, scrollback, ring buffer, font_family `Menlo, Monaco, 'Courier New', monospace`, font_size `14`, sidebar width, notification, confirm_close_running, copy_on_select, quit_when_no_tabs, close_tab_on_clean_exit, tab navigation key bindings defaulting to disabled with prefix `ctrl+j`, next `n`, previous `p`) and load it on subsequent starts. A config file written before the key binding keys existed SHALL load with those defaults filled in.

#### Scenario: First launch creates config
- **WHEN** the config file does not exist at startup
- **THEN** the daemon writes defaults and continues with those values

#### Scenario: Existing config is respected
- **WHEN** the config file already exists
- **THEN** the daemon uses its values for port, shell, font, and related settings

#### Scenario: Older config gains key binding defaults
- **WHEN** an existing config file has no key binding keys
- **THEN** the daemon fills in the disabled default bindings and keeps every other stored value

#### Scenario: Invalid key binding is rejected on patch
- **WHEN** a config patch sets a prefix without a modifier, or the same key for next and previous
- **THEN** the daemon rejects the patch with an error and the stored config is unchanged
