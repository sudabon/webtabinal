# tab-memo Specification

## Purpose
TBD - created by archiving change tab-memo. Update Purpose after archive.
## Requirements
### Requirement: Double-click opens memo editor

Double-clicking a sidebar tab SHALL open a modal dialog for editing that session's memo. The dialog SHALL contain a text field, a save action, and a cancel action. Escape and activating the backdrop SHALL close the dialog without saving.

#### Scenario: Open editor from tab

- **WHEN** the user double-clicks a sidebar tab
- **THEN** a memo editor dialog is shown with that session's current memo (empty if none)

#### Scenario: Cancel discards edits

- **WHEN** the memo editor is open, the user changes the field, and then cancels, presses Escape, or activates the backdrop
- **THEN** the dialog closes and the session memo is unchanged

### Requirement: Memo is at most 30 characters

A memo SHALL contain at most 30 Unicode code points after trimming leading and trailing whitespace. The editor SHALL prevent entering more than 30 code points. Saving a trimmed-empty value SHALL clear the memo.

#### Scenario: Save within limit

- **WHEN** the user enters 30 or fewer Unicode code points and saves
- **THEN** the session memo is updated to the trimmed value and the dialog closes

#### Scenario: Empty save clears memo

- **WHEN** the user saves a field that is empty or only whitespace
- **THEN** the session memo becomes empty

#### Scenario: Over-limit input is blocked

- **WHEN** the user attempts to type an additional character beyond 30 Unicode code points
- **THEN** the field does not accept the extra character

### Requirement: Delayed hover tooltip

When a tab has a non-empty memo, hovering the pointer over that tab for 2000ms SHALL show a tooltip containing the memo. The tooltip SHALL hide when the pointer leaves the tab or the memo editor opens. Tabs with an empty memo SHALL NOT show a memo tooltip.

#### Scenario: Tooltip appears after delay

- **WHEN** a tab has memo `CI watch` and the pointer remains over the tab for 2000ms
- **THEN** a tooltip showing `CI watch` is visible

#### Scenario: Leave before delay shows nothing

- **WHEN** the pointer leaves the tab before 2000ms
- **THEN** no memo tooltip is shown

#### Scenario: Empty memo has no tooltip

- **WHEN** the tab memo is empty and the pointer hovers the tab for 2000ms
- **THEN** no memo tooltip is shown

