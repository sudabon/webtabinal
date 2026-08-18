## 1. State and manifest foundations

- [x] 1.1 Confirm the `add-vt-screen-model` snapshot and lifecycle contracts are available, then add `internal/agentdetect` state, signal, identity, immutable snapshot, clock, scheduler, and screen-provider types
- [x] 1.2 Define schema-version-1 manifest structs for identity matchers, screen rules, state authorities, OSC authority, quiescence, activity thresholds, and verified versions
- [x] 1.3 Implement strict JSON decoding, enum/range validation, unknown/action-field rejection, and load-time regex compilation with metadata-only errors
- [x] 1.4 Embed initial Claude Code, Codex, and blocked-disabled generic manifests and build an immutable startup registry
- [x] 1.5 Resolve the default Application Support manifest directory and implement ID-based local replacement, invalid-override suppression, and restart-required semantics
- [x] 1.6 Add loader tests for bundled assets, duplicate IDs, every validation failure, valid local precedence, invalid local suppression, and post-start file edits

## 2. Agent identity detection

- [x] 2.1 Implement per-session detector creation/close under a manager-level engine with cancellable timers and injectable dependencies
- [x] 2.2 Match shell command-start lines and foreground executables with deterministic exact-executable, command-pattern, then generic precedence
- [x] 2.3 Add a platform seam for TIOCGPGRP and foreground executable/ancestry inspection, reusing existing fallback behavior without failing sessions on inspection errors
- [x] 2.4 Detect unrecognized alternate-screen or non-shell foreground TUIs as generic while leaving ordinary shells as empty identity and `none`
- [x] 2.5 Clear provisional and confirmed identities when the shell prompt returns and no matching foreground agent remains
- [x] 2.6 Add identity tests for integrated commands, unintegrated processes, wrappers, ambiguous matches, generic fallback, inspector failure, and agent exit

## 3. State evaluation and safety rules

- [x] 3.1 Implement monotonic output-activity accounting, the 120 ms trailing screen debounce, default 32-byte/1000 ms activity, and 1500 ms quiescence using the injected clock/scheduler
- [x] 3.2 Evaluate precompiled manifest patterns over the selected bottom-line snapshot in manifest order and return pattern IDs/line indexes without retaining matched screen text
- [x] 3.3 Implement authority-gated priority for immediate blocked, working evidence, quiescent idle, blocked clearing, and subsequent output transitions
- [x] 3.4 Integrate manifest-authorized OSC 9/99/777 completion acceleration without allowing OSC to override higher-priority blocked evidence
- [x] 3.5 Implement unknown-screen and unavailable-screen idle-safe behavior and enforce that generic activity can produce only working or idle
- [x] 3.6 Add table and property tests for unauthorized signals, streaming pauses, debounce coalescing, immediate blocked, blocked clearing, OSC acceleration, unknown-to-idle, and generic-never-blocked

## 4. Snapshot, subscription, and session wiring

- [x] 4.1 Implement current snapshot lookup with stable `since`, source signal, and non-sensitive detail plus transition-only subscriptions invoked outside locks
- [x] 4.2 Implement and test the pure `blocked > working > idle > none` roll-up helper and empty-input behavior
- [x] 4.3 Wire session output metadata and updated VT snapshots into detectors without adding regex work to the PTY read loop
- [x] 4.4 Wire parsed OSC events, shell command/prompt lifecycle, and periodic foreground observations into the correct session detector
- [x] 4.5 Wire session close/restart to timer cancellation and state removal, and add race tests proving no callbacks fire from a closed detector generation
- [x] 4.6 Keep detector adapters observation-only and add compile-time/test assertions that no PTY writer, input callback, process action, or manifest response field is exposed

## 5. Fixture calibration and verification

- [x] 5.1 Capture minimal, reviewed Claude Code and Codex idle/working/blocked/unknown test streams with exact versions for this change's regression suite
- [x] 5.2 Replace provisional patterns and activity thresholds in the bundled manifests from fixture evidence and reconcile every `verified_against` entry
- [x] 5.3 Add deterministic fake-clock replay tests for Claude Code, Codex, and generic transition timelines, including positive and other-state negative pattern cases
- [x] 5.4 Run agent-detection, session, OSC, and full Go tests under the race detector and confirm existing shell state and notification wire behavior remain unchanged
