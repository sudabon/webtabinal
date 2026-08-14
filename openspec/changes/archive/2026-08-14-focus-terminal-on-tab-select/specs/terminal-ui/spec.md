## ADDED Requirements

### Requirement: Focus the terminal after tab select

After the user selects a session to work in, the UI SHALL move keyboard focus to the active terminal so keystrokes go to the shell without an extra click on the terminal pane. This SHALL apply to sidebar tab click (including clicking the already-active tab), `Cmd+1`..`9` session switch, and new tab creation.

#### Scenario: Clicking a tab focuses the shell

- **WHEN** the user clicks a sidebar tab for a session
- **THEN** that session is active and the terminal accepts keyboard input without a further click on the terminal pane

#### Scenario: Clicking the active tab still focuses the shell

- **WHEN** the already-active tab is clicked
- **THEN** the terminal accepts keyboard input without a further click on the terminal pane

#### Scenario: Cmd-number switch focuses the shell

- **WHEN** the user presses Cmd+2 and at least two sessions exist
- **THEN** the second session from the top becomes active and the terminal accepts keyboard input without a further click on the terminal pane

#### Scenario: New tab focuses the shell

- **WHEN** the user creates a new tab
- **THEN** the new session is active and the terminal accepts keyboard input without a further click on the terminal pane

### Requirement: Modals keep focus when open

While the settings modal or tab memo editor is open, selecting or showing a session SHALL NOT steal keyboard focus from that modal's controls.

#### Scenario: Memo editor keeps the input focused

- **WHEN** the user double-clicks a tab to edit its memo
- **THEN** the memo editor input remains focused and keystrokes go to the memo, not the PTY

#### Scenario: Settings modal keeps its focus

- **WHEN** the settings modal is open
- **THEN** the terminal does not take keyboard focus away from the modal
