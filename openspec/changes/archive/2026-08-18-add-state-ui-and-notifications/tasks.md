## 1. State configuration and runtime control

- [x] 1.1 Confirm the `add-agent-state-engine` snapshot/subscription API is available, then add nested `StateConfig` fields and the documented enabled, timing, line, notification, and manifest-directory defaults
- [x] 1.2 Extend config loading so older files gain only missing state defaults while preserving explicit false and zero-allowed values and every unrelated setting
- [x] 1.3 Validate debounce 20–5000 ms, quiescence 0–60000 ms, bottom lines 1–200, and empty-or-absolute manifest directory atomically on config patches
- [x] 1.4 Add a post-commit runtime configuration seam that applies enabled/timing/line/notify changes atomically while marking manifest-directory changes as restart-required
- [x] 1.5 Implement disable cancellation plus `none` transitions and re-enable evaluation for all live sessions without stopping existing OSC parsing
- [x] 1.6 Add config default, partial-old-file, explicit-false, invalid-patch rollback, and runtime disable/re-enable tests

## 2. Agent-state transport

- [x] 2.1 Enrich REST and WebSocket session snapshots with agent ID, state, RFC 3339 `since`, signal, and non-sensitive optional detail from one engine snapshot
- [x] 2.2 Subscribe the WebSocket Hub to identity/state transitions and broadcast unattached `t=agent_state` frames without modifying existing shell `t=state` frames
- [x] 2.3 Make initial `sessions` enqueue and later transition enqueue ordering deterministic for newly connected clients
- [x] 2.4 Add server tests for ordinary `none`, reconnect-to-blocked, unattached transitions, repeated-evidence suppression, initial-sync races, and backward-compatible existing frames
- [x] 2.5 Extend TypeScript session/server-message types and the app reducer to merge initial and live agent state without overwriting shell state or dropping unknown additive fields
- [x] 2.6 Add frontend WebSocket tests for snapshot restore, transition updates, duplicate suppression, reconnect ordering, and unknown-message compatibility

## 3. Blocked notifications and cross-signal dedupe

- [x] 3.1 Add a session-scoped notification arbiter with an injected monotonic clock, a four-second agent-attention window, first-wins emission, and close-time cleanup
- [x] 3.2 Route non-blocked-to-blocked transitions through the arbiter when enabled and emit existing `notify` frames with additive `kind=agent_blocked` and `source=screen`
- [x] 3.3 Route OSC 9/99/777 wait notifications through the same arbiter while preserving OSC delivery when state detection or blocked notification is disabled
- [x] 3.4 Keep blocked events outside `notification.min_duration_ms` while reusing enabled, always, focus suppression, platform provider, unread, and activation behavior
- [x] 3.5 Add fake-clock server tests for OSC-first, screen-first, per-session independence, post-window delivery, state-transition preservation, and repeated blocked evidence
- [x] 3.6 Extend frontend notification tests to prove native/Web delivery occurs exactly once, active-focused `always` semantics remain intact, and missing permission retains existing unread behavior

## 4. Sidebar state presentation

- [x] 4.1 Add a focused agent-state pill component that omits `none` and presents agent-specific accessible labels for idle, working, and blocked
- [x] 4.2 Style muted idle, compositor-only working motion, static reduced-motion working, and non-flashing non-color-only blocked attention states
- [x] 4.3 Integrate the pill beside existing top-row indicators without replacing CWD, command, shell state, elapsed time, exit status, integration, memo, or unread UI
- [x] 4.4 Preserve daemon order, drag-and-drop, Cmd+number, prefix navigation, single/double click, context menu, and terminal focus behavior across agent transitions
- [x] 4.5 Add component/app tests for every pill state, accessible names, reduced motion, shell/agent coexistence, unread persistence, and unchanged ordering/interactions

## 5. Notification settings UI

- [x] 5.1 Add state detection and blocked-notification controls to Notifications settings plus a collapsible advanced section for debounce, quiescence, bottom lines, and manifest directory
- [x] 5.2 Show bounds, manifest-overrides-global guidance, default-directory behavior, and a persistent daemon-restart notice for manifest-directory changes
- [x] 5.3 Reuse immediate config persistence, disable dependent controls while retaining values, and roll back only the failed state fields with a visible error
- [x] 5.4 Add settings tests for basic/advanced navigation, successful persistence, invalid numeric rollback, unrelated notification preservation, disable, and re-enable

## 6. Documentation and end-to-end verification

- [x] 6.1 Update README settings, agent-state, notification, dedupe, `always`, duration-exemption, disabled-mode, and reconnect behavior tables
- [x] 6.2 Run focused config/server/session/notification Go tests and the complete Go suite under the race detector
- [x] 6.3 Run all frontend unit tests, TypeScript checks, and the production Vite build
- [x] 6.4 Run desktop notification bridge tests and verify blocked events still use exactly one native or Web provider without changing activation routing
- [x] 6.5 Manually verify daemon-only state continuity, reconnect snapshot, foreground/background suppression, OSC/screen dedupe, reduced motion, and no automatic tab reorder
