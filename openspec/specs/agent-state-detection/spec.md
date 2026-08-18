# agent-state-detection Specification

## Purpose
TBD - created by archiving change add-agent-state-engine. Update Purpose after archive.
## Requirements
### Requirement: Agent state is separate from shell command state

The daemon SHALL maintain a current agent identity and agent state (`none`, `idle`, `working`, or `blocked`) for every live session independently of the existing shell command state (`starting`, `idle`, `running`, or `exited`). A session with no detected agent SHALL have agent state `none`.

#### Scenario: Agent turn changes do not complete the shell command
- **WHEN** an agent process remains the running shell command and its detected state changes from `working` to `blocked`
- **THEN** the agent state becomes `blocked` while the shell command state remains `running`

#### Scenario: Ordinary shell session has no agent state
- **WHEN** a live shell has no matching agent command, executable, or generic full-screen TUI
- **THEN** its agent identity is empty and its agent state is `none`

#### Scenario: Closing a session removes detector state
- **WHEN** a session exits or is closed
- **THEN** its current agent snapshot and pending evaluations are removed

### Requirement: Agent identity uses command and foreground process signals

The detector SHALL match manifest command patterns from shell-integration command-start events as the primary identity signal and SHALL use the foreground process executable or ancestry as confirmation and as a fallback for non-integrated sessions. Exact executable matches SHALL take precedence over command-pattern-only matches, which SHALL take precedence over the generic manifest.

#### Scenario: Integrated command identifies an agent
- **WHEN** shell integration reports a command line that matches the Codex manifest
- **THEN** the session receives the Codex identity without waiting for screen text to identify the product

#### Scenario: Foreground process identifies an unintegrated agent
- **WHEN** shell integration is unavailable and the foreground process executable matches the Claude Code manifest
- **THEN** the session receives the Claude Code identity

#### Scenario: Wrapper process is resolved through ancestry
- **WHEN** the foreground process is a wrapper whose process ancestry contains an executable matched by a manifest
- **THEN** the matched agent identity is selected instead of generic

#### Scenario: Unrecognized full-screen process uses generic
- **WHEN** a non-shell foreground process uses the alternate screen and no dedicated manifest matches
- **THEN** the detector selects the generic identity

#### Scenario: Agent exit clears stale command identity
- **WHEN** the shell prompt returns and no matching agent process remains in the foreground
- **THEN** the agent identity and state return to empty and `none`

### Requirement: Versioned manifests define signal authority

The daemon SHALL load schema-versioned `claude`, `codex`, and `generic` JSON manifests from embedded assets. Each manifest SHALL define identity matching, screen selection, state patterns, authority per state, OSC authority, quiescence, activity thresholds, and verified agent versions. Regex patterns SHALL be compiled once during load.

#### Scenario: Bundled manifests load at daemon startup
- **WHEN** the daemon starts with no local manifest directory entries
- **THEN** validated embedded Claude Code, Codex, and generic manifests are available to new and existing session detectors

#### Scenario: Unknown manifest field is rejected
- **WHEN** a manifest contains an unknown field, unsupported schema version, invalid enum, invalid regex, or out-of-range duration
- **THEN** that manifest is rejected with an error that identifies the file and field without logging terminal screen contents

#### Scenario: Manifest records verified versions
- **WHEN** a dedicated bundled manifest is accepted
- **THEN** its non-empty `verified_against` values correspond to the agent fixtures used by its regression tests

### Requirement: Local manifests override bundled manifests at startup

The daemon SHALL load JSON files from the configured local manifest directory at startup and SHALL replace a bundled manifest by manifest ID when a valid local file uses the same ID. Manifest files added or changed after startup SHALL require a daemon restart in v1.

#### Scenario: Valid local override wins
- **WHEN** the local directory contains a valid `codex` manifest with different patterns from the embedded `codex` manifest before daemon startup
- **THEN** all Codex detectors use the local manifest for that daemon process

#### Scenario: Invalid override does not silently use the bundled manifest
- **WHEN** a local file for an embedded manifest ID is invalid
- **THEN** the local error is reported, the bundled manifest with that ID is not silently activated, and detection falls back to generic or idle-safe behavior

#### Scenario: Runtime file edit waits for restart
- **WHEN** a local manifest is edited after the daemon has loaded its registry
- **THEN** active detectors retain the loaded registry until the daemon is restarted

### Requirement: State transitions obey authority, priority, and hysteresis

The detector SHALL allow a signal to write a state only when the selected manifest grants that signal authority. It SHALL evaluate authorized state evidence in `blocked`, `working`, then `idle` priority and SHALL use monotonic time for debounce, activity, and quiescence decisions.

#### Scenario: Blocked pattern transitions without quiescence
- **WHEN** an authorized blocked screen pattern is present at a screen evaluation
- **THEN** the state becomes `blocked` without waiting for the quiescence interval

#### Scenario: Blocked clears when its evidence disappears
- **WHEN** a previously matched blocked pattern disappears from the selected screen lines
- **THEN** the detector removes `blocked` and recomputes `working` or `idle` from the remaining authorized evidence

#### Scenario: Active output supports working
- **WHEN** output in the configured activity window meets the selected manifest's byte threshold and activity has working authority
- **THEN** the session state is `working`

#### Scenario: Working does not fall idle during a streaming pause
- **WHEN** an idle or unknown screen shape is visible but output has not been quiet for the selected quiescence interval
- **THEN** a `working` session remains `working`

#### Scenario: Quiet idle prompt becomes idle
- **WHEN** an authorized idle pattern is present and output has been quiet for the selected quiescence interval
- **THEN** the state becomes `idle`

#### Scenario: Authoritative completion OSC advances idle
- **WHEN** the selected manifest declares completion OSC authoritative and the detector receives an OSC 9, OSC 99, or OSC 777 completion event with no higher-priority blocked evidence
- **THEN** the state becomes `idle` before the normal quiescence interval and later output can return it to `working`

#### Scenario: Unauthorized signal cannot write a state
- **WHEN** a signal indicates `blocked` but the selected manifest does not grant that signal blocked authority
- **THEN** that signal does not set the session state to `blocked`

### Requirement: Unknown screen shapes fail safe to idle

An identified agent whose selected screen lines match no state pattern SHALL resolve to `idle` after output quiescence unless another authorized signal currently establishes `working`. The generic manifest MUST NOT grant blocked authority or emit `blocked`.

#### Scenario: Dedicated manifest sees an unknown quiet screen
- **WHEN** an identified Claude Code or Codex session has an unmatched screen and output has been quiet for the quiescence interval
- **THEN** the agent state is `idle`, not `blocked`

#### Scenario: Generic activity stops
- **WHEN** a generic session was `working` from activity and then remains quiet for the quiescence interval
- **THEN** the state becomes `idle`

#### Scenario: Generic never becomes blocked
- **WHEN** any screen text is shown while the generic manifest is selected
- **THEN** the detector never emits `blocked`

#### Scenario: Screen model is unavailable
- **WHEN** an identified agent has no available VT snapshot and no authorized signal establishes working or blocked
- **THEN** the detector uses idle-safe behavior and does not infer `blocked`

### Requirement: Output-driven evaluation is bounded and deterministic

Screen evaluation SHALL be scheduled with a default 120 ms trailing debounce after output, while activity accounting SHALL continue during sustained output. The default quiescence SHALL be 1500 ms and the default activity threshold SHALL be 32 bytes in a 1000 ms window unless a manifest or later runtime configuration supplies an override.

#### Scenario: Burst output coalesces screen evaluation
- **WHEN** multiple output chunks arrive within one 120 ms debounce interval and then stop
- **THEN** the detector evaluates the final screen shape once after the burst rather than once per chunk

#### Scenario: Sustained output remains working
- **WHEN** output continues long enough to repeatedly satisfy the activity threshold even though the trailing screen evaluation is postponed
- **THEN** activity authority keeps the session in `working`

#### Scenario: Fake clock reproduces a transition timeline
- **WHEN** the same fixture chunks and virtual timestamps are replayed repeatedly
- **THEN** the detector emits the same ordered identity, state, signal, and transition-count results

### Requirement: Current snapshots and transition subscriptions

The engine SHALL provide an immutable current snapshot containing session ID, agent ID, state, state-entry time, source signal, and non-sensitive diagnostic detail. It SHALL notify subscribers only when identity or state changes and SHALL invoke callbacks outside engine locks.

#### Scenario: Repeated evidence does not reset state time
- **WHEN** repeated evaluations confirm the same agent identity and state
- **THEN** no duplicate transition is emitted and the state's `since` timestamp is unchanged

#### Scenario: State change notifies subscribers
- **WHEN** a session changes from `working` to `blocked`
- **THEN** each active subscriber receives one immutable transition containing the new state and its source signal

#### Scenario: Slow subscriber does not hold detector locks
- **WHEN** a subscriber performs slow work while another session is evaluated
- **THEN** engine state remains readable and detector locks are not held by the callback

### Requirement: Multi-state roll-up has fixed priority

The detector library SHALL expose a pure roll-up operation with priority `blocked > working > idle > none`; rolling up an empty collection SHALL return `none`.

#### Scenario: Blocked dominates other states
- **WHEN** child states contain `idle`, `working`, and `blocked`
- **THEN** their roll-up is `blocked`

#### Scenario: Empty roll-up is none
- **WHEN** no child states are supplied
- **THEN** the roll-up is `none`

### Requirement: Detection is observation-only

The agent-state package MUST NOT expose a PTY write handle, input callback, approval action, or manifest action field. State observations and transitions MUST NOT cause terminal input or process control.

#### Scenario: Blocked detection has no terminal side effect
- **WHEN** a session transitions to `blocked`
- **THEN** the detector records and publishes the transition without writing bytes to the PTY or signaling the agent process

#### Scenario: Manifest cannot define an automatic response
- **WHEN** a manifest is decoded
- **THEN** any action or response field is rejected as unknown rather than executed

