## 1. VT adapter contract and selection spike

- [x] 1.1 Add the `internal/vtscreen` buffer selector, immutable snapshot, screen lifecycle, and injectable factory interfaces with package-level contract tests
- [x] 1.2 Add raw conformance fixtures for primary screen edits, DECSET/DECRST 1049, DECSTBM, cursor erase/movement, combining marks, Japanese wide glyphs, and resize
- [x] 1.3 Run the same fixture suite against `charmbracelet/x/vt` and `hinshun/vt10x`, recording alt-buffer access, CJK behavior, resize semantics, maintenance status, and dependency cost in a scorecard
- [x] 1.4 Select the smallest candidate that passes every mandatory fixture, document the decision, and add only the selected Go dependency

## 2. Headless screen implementation

- [x] 2.1 Implement ordered `Feed` support for independent primary and alternate buffers and active-buffer tracking behind the adapter
- [x] 2.2 Implement `active`, `primary`, and `alternate` bottom-line snapshots with blank-row retention, trailing-cell trimming, and correct wide/combining glyph normalization
- [x] 2.3 Implement initial geometry, successful resize propagation, immutable snapshot copies, and lifecycle-safe `Close`
- [x] 2.4 Isolate construction, malformed-input, and emulator failures as model unavailability with rate-limited metadata-only logging
- [x] 2.5 Add unit, fuzz, and concurrent feed/resize/snapshot tests for the adapter, including post-close behavior

## 3. Session integration

- [x] 3.1 Add a screen factory seam to session creation and create one model from each PTY's initial rows and columns without rejecting the session on model failure
- [x] 3.2 Tee copied PTY chunks into the model in read-loop order before output callbacks while preserving ring-buffer, OSC-parser, and WebSocket bytes exactly
- [x] 3.3 Wire accepted session resizes and session close/exit into the screen model and expose a read-only snapshot accessor for later detector integration
- [x] 3.4 Add session integration tests for no-client reconstruction, alternate-screen restoration, CJK output, resize success/failure, and model failure isolation

## 4. Performance and regression verification

- [x] 4.1 Add a deterministic 100 MiB modeled/unmodeled benchmark and assert byte identity and ordering at every existing output sink
- [x] 4.2 Measure a 200x60 primary-plus-alternate model's per-session memory, record whether it meets the 1 MiB review target, and document relative throughput results
- [x] 4.3 Run focused VT/session tests and the complete Go suite under the race detector, fixing any lifecycle or lock-order failures
- [x] 4.4 Confirm existing replay, OSC parsing, resize, session lifecycle, and server tests pass without wire-protocol changes
