## 1. Backend session memo

- [x] 1.1 Add `Memo` to `session.Session` and `Info` JSON (`memo`)
- [x] 1.2 Add `SetMemo` (trim, reject > 30 Unicode code points)
- [x] 1.3 Copy memo on Restart; leave Duplicate memo empty
- [x] 1.4 Add session tests for set/limit/restart copy/duplicate empty

## 2. REST API

- [x] 2.1 Add `PATCH /api/sessions/{id}` accepting `{ "memo": "..." }`
- [x] 2.2 Validate, persist, return updated session, broadcast WS `sessions`
- [x] 2.3 Add API tests for success, over-limit 400, unknown id

## 3. Frontend types and client

- [x] 3.1 Add `memo` to `SessionInfo` and `api.patchSessionMemo`
- [x] 3.2 Add Unicode code-point length helper and tests (30-char clamp)

## 4. Memo editor UI

- [x] 4.1 Build `TabMemoModal` (input, remaining count, save/cancel, Esc, backdrop)
- [x] 4.2 Wire Sidebar double-click to open the modal for that session
- [x] 4.3 On save, PATCH then update local session list; toast + keep open on error

## 5. Hover tooltip

- [x] 5.1 Show delayed (2000ms) tooltip on tabs with non-empty memo; hide on leave or modal open
- [x] 5.2 Style tooltip with theme tokens so it does not collide with command-row native title

## 6. Verify

- [x] 6.1 Run Go session/API tests and frontend tests for changed files
- [x] 6.2 Manually verify double-click edit, 30-char limit, empty clear, hover tooltip, restart copy, duplicate empty
