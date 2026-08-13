## ADDED Requirements

### Requirement: Tab double-click edits memo

Double-clicking a sidebar tab SHALL open the memo editor for that session. Existing click-to-select, drag-and-drop reorder, and context menu actions SHALL remain available.

#### Scenario: Double-click opens memo editor

- **WHEN** the user double-clicks a tab
- **THEN** the memo editor for that session is shown and the tab remains selectable by single click

### Requirement: Tab memo tooltip on hover

A tab with a non-empty memo SHALL show that memo in a delayed tooltip as specified by `tab-memo`. The command-row native tooltip for the truncated command SHALL remain.

#### Scenario: Memo tooltip does not replace command tooltip

- **WHEN** a tab has both a memo and a truncated command line
- **THEN** the delayed memo tooltip can appear on tab hover and the command row may still expose its native title
