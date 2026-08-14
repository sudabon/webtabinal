## 1. Focus request from tab selection

- [x] 1.1 Add a `focusSeq` (or equivalent) in `App` that increments on tab select, including clicking the already-active tab, and on `Cmd+1`..`9`
- [x] 1.2 Increment the same sequence when creating a new tab
- [x] 1.3 Do not increment it from memo edit (`onEditMemo`) so double-click does not request terminal focus
- [x] 1.4 Pass the sequence (and whether settings/memo modal is open) to `TerminalView`

## 2. Apply focus in TerminalView

- [x] 2.1 After xterm is created for the active session, call `term.focus()` when a focus request is pending and no modal is open
- [x] 2.2 Keep the focus effect after the `[sessionId]` recreate effect so a session switch focuses the new instance, not the disposed one
- [x] 2.3 Skip `term.focus()` while the settings modal or tab memo editor is open

## 3. Verify

- [x] 3.1 Add frontend tests that cover: tab select requests focus, same-tab reclick requests focus, memo/settings open does not steal focus, and `term.focus()` is invoked after session recreate
- [x] 3.2 Run the frontend tests for the changed files
- [x] 3.3 Manually confirm: click another tab and type immediately, click the active tab and type, Cmd+2 then type, new tab then type, double-click memo still types in the memo field, settings modal keeps focus
