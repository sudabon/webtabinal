## ADDED Requirements

### Requirement: Copy selection with Cmd+C

When the terminal is focused, Cmd+C SHALL copy the current xterm selection to the clipboard if the selection is non-empty. Cmd+C SHALL NOT send an interrupt to the PTY. Ctrl+C SHALL continue to send interrupt as today.

#### Scenario: Cmd+C copies a selection

- **WHEN** the terminal has a non-empty selection and the user presses Cmd+C
- **THEN** that text is placed on the clipboard and the PTY does not receive ETX

#### Scenario: Cmd+C with no selection is a no-op

- **WHEN** the terminal has no selection and the user presses Cmd+C
- **THEN** the clipboard is left unchanged and the PTY does not receive ETX

#### Scenario: Ctrl+C still interrupts

- **WHEN** the user presses Ctrl+C while the terminal is focused
- **THEN** the session receives interrupt (ETX) as before this change

### Requirement: Paste with Cmd+V

When the terminal is focused, Cmd+V SHALL paste the clipboard text into the session as terminal input.

#### Scenario: Cmd+V pastes into the terminal

- **WHEN** the clipboard contains text and the user presses Cmd+V while the terminal is focused
- **THEN** that text is written to the session as if pasted in a native terminal

### Requirement: Text fields keep native clipboard shortcuts

Copy and paste shortcuts SHALL NOT be intercepted when a normal text field (settings, memo, or similar) is focused.

#### Scenario: Settings field uses native copy

- **WHEN** a settings text input is focused and the user presses Cmd+C with selected field text
- **THEN** that field text is copied and the terminal selection is not used

#### Scenario: Memo field uses native paste

- **WHEN** the tab memo input is focused and the user presses Cmd+V
- **THEN** the clipboard text is inserted into the memo field, not the PTY
