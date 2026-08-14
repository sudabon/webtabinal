## ADDED Requirements

### Requirement: Edit menu copy and paste

The native app SHALL provide an Edit menu with Copy (⌘C) and Paste (⌘V). These items SHALL perform the same copy and paste operations as the keyboard shortcuts, including the distinction between a focused terminal and a focused text field.

#### Scenario: Edit menu Copy copies terminal selection

- **WHEN** the terminal has a non-empty selection and the user chooses Edit → Copy
- **THEN** that selection is placed on the system clipboard

#### Scenario: Edit menu Paste pastes into the terminal

- **WHEN** the terminal is focused and the user chooses Edit → Paste while the clipboard has text
- **THEN** that text is pasted into the session

### Requirement: Desktop clipboard uses the system pasteboard

Copy and paste in the native app SHALL use the macOS pasteboard so they work even when WKWebView does not expose the web Clipboard API. Paste into the terminal SHALL NOT depend on `navigator.clipboard.readText`.

#### Scenario: Paste works without the web clipboard API

- **WHEN** the user pastes into the terminal in the native app
- **THEN** the text comes from the system pasteboard and is inserted into the session
