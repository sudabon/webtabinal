## ADDED Requirements

### Requirement: Edit menu toggles the sidebar

The native app's Edit menu SHALL include an item that toggles the left sidebar, invoking the same toggle as the in-app control. Because the shortcut is a two-stroke chord that macOS cannot express as a menu key equivalent, the item SHALL carry no key equivalent. The item SHALL be disabled, or SHALL do nothing, when the web UI has not finished loading.

#### Scenario: Edit menu item collapses the sidebar

- **WHEN** the sidebar is expanded and the user chooses Edit → the sidebar toggle item
- **THEN** the sidebar collapses in the web UI

#### Scenario: Edit menu item expands the sidebar

- **WHEN** the sidebar is collapsed and the user chooses Edit → the sidebar toggle item
- **THEN** the sidebar expands in the web UI

#### Scenario: Item shows no key equivalent

- **WHEN** the user opens the Edit menu
- **THEN** the sidebar toggle item is listed with no keyboard shortcut shown next to it

#### Scenario: Item is inert before the UI loads

- **WHEN** the web UI has not finished loading and the user chooses the sidebar toggle item
- **THEN** the app does not crash and no sidebar change is attempted
