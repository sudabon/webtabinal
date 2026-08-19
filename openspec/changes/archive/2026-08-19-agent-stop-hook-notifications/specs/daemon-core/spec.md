## ADDED Requirements

### Requirement: Notify CLI reports turn completion from a hook

The daemon binary SHALL provide `webtabinal notify`. It SHALL take the session from `--session` or, when that is absent, from `WEBTABINAL_SESSION_ID`. It SHALL read the authentication token and port from the existing config file and call the session notification endpoint. It SHALL accept `--title`, `--body`, and `--kind`.

The command SHALL NOT start the daemon. When the daemon is not running, when no session can be determined, or when the request fails, it SHALL exit zero without output, because a coding agent's stop hook must not be turned into a failure by a notification that could not be delivered.

#### Scenario: Hook reports the current session

- **WHEN** the command runs inside a WebTabinal session with `WEBTABINAL_SESSION_ID` set and the daemon listening
- **THEN** it posts the report for that session and exits zero

#### Scenario: Explicit session overrides the environment

- **WHEN** the command is given `--session` and the environment also names a session
- **THEN** the given session is used

#### Scenario: Missing daemon is not an error

- **WHEN** the daemon is not listening
- **THEN** the command exits zero, prints nothing, and does not start the daemon

#### Scenario: Missing session is not an error

- **WHEN** neither `--session` nor `WEBTABINAL_SESSION_ID` names a session
- **THEN** the command exits zero and prints nothing

### Requirement: Hook snippet CLI

The daemon binary SHALL provide `webtabinal hooks print <agent>` for `claude`, `codex`, and `cursor-agent`. It SHALL print a ready-to-paste configuration snippet and the path of the file it belongs in. It SHALL NOT read or modify any agent's configuration file, because those files are shared with other tools and can already hold an unrelated entry in the same slot.

#### Scenario: Snippet is printed for a supported agent

- **WHEN** the user runs the command for `cursor-agent`
- **THEN** a `hooks.json` snippet with a `stop` entry and the target path `~/.cursor/hooks.json` are printed

#### Scenario: Unsupported agent is rejected

- **WHEN** the user names an agent that is not supported
- **THEN** the command reports the supported names and exits non-zero

#### Scenario: Agent configuration is never modified

- **WHEN** the command runs
- **THEN** no agent configuration file is created or changed

## MODIFIED Requirements

### Requirement: Config file with defaults
The daemon SHALL create `~/Library/Application Support/WebTabinal/config.json` on first launch with documented defaults (port `8642`, shell, scrollback, ring buffer, font_family `Menlo, Monaco, 'Courier New', monospace`, font_size `14`, sidebar width, notification, agent-state detection, confirm_close_running, copy_on_select, quit_when_no_tabs, close_tab_on_clean_exit, tab navigation key bindings defaulting to disabled with prefix `ctrl+j`, next `n`, previous `p`) and load it on subsequent starts. Notification defaults SHALL include `commands=["claude","codex","cursor-agent","agent"]`. Agent-state defaults SHALL be `enabled=true`, `debounce_ms=120`, `quiescence_ms=1500`, `bottom_lines=15`, `notify_on_blocked=true`, `notify_on_idle=false`, and `manifest_dir=""`, where an empty manifest directory resolves to the Application Support default. A config file written before the key binding, agent-state, or notification-command keys existed SHALL load with those defaults filled in, while an explicitly stored empty command list SHALL be preserved.

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

#### Scenario: Explicit empty command list is preserved
- **WHEN** an existing config file stores `notification.commands` as an empty list
- **THEN** the daemon keeps the empty list rather than restoring the default entries

#### Scenario: Invalid key binding is rejected on patch
- **WHEN** a config patch sets a prefix without a modifier, or the same key for next and previous
- **THEN** the daemon rejects the patch with an error and the stored config is unchanged

#### Scenario: Invalid agent-state timing is rejected on patch
- **WHEN** a config patch sets debounce outside 20–5000 ms, quiescence outside 0–60000 ms, or bottom lines outside 1–200
- **THEN** the daemon rejects the patch and leaves both stored and runtime agent-state settings unchanged

#### Scenario: Blank notification command entry is rejected on patch
- **WHEN** a config patch sets `notification.commands` to a list containing an empty or whitespace-only entry
- **THEN** the daemon rejects the patch and preserves the previous list

#### Scenario: Relative manifest directory is rejected
- **WHEN** a config patch sets a non-empty `state.manifest_dir` to a relative path
- **THEN** the daemon rejects the patch and preserves the previous manifest directory
