## 1. OSC parser

- [x] 1.1 Add `EventNotify` with title/body to `internal/osc`
- [x] 1.2 Parse OSC 9 (payload after `9;`) and OSC 99 (`p=title` / `p=body` or trailing payload)
- [x] 1.3 Ignore empty title+body; keep BEL and ST terminators
- [x] 1.4 Add parser tests; confirm OSC 7 / 133 / 9973 still work

## 2. Session and WebSocket

- [x] 2.1 Leave session CWD/command/state unchanged on `EventNotify`
- [x] 2.2 Broadcast `{"t":"notify","sid","title","body"}` to all WS clients without requiring attach
- [x] 2.3 Add tests that notify is emitted and running state is preserved

## 3. Frontend notifications

- [x] 3.1 Add `notify` to `ServerMsg` types
- [x] 3.2 Show desktop Notification from `notify` with the same enabled/always/focus suppression as completion; do not apply `min_duration_ms`
- [x] 3.3 Mark non-active tabs unread and bump Dock badge; click focuses and switches tab
- [x] 3.4 Add frontend tests for wait notify vs suppressed active+focused

## 4. Docs and verify

- [x] 4.1 Document Claude Code / Codex / cursor-agent OSC enablement in README
- [x] 4.2 Run Go tests and frontend tests for changed files
