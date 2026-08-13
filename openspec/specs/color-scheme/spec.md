# color-scheme Specification

## Purpose
TBD - created by archiving change settings-theme-modal. Update Purpose after archive.
## Requirements
### Requirement: Color scheme configuration

The system SHALL store a `color_scheme` setting with one of the values `light`, `dark`, or `system`, exposed via the existing config API.

#### Scenario: Default color scheme

- **WHEN** config is created with defaults or `color_scheme` is absent from stored config
- **THEN** the effective configured value is `system`

#### Scenario: Persist color scheme via PATCH

- **WHEN** the client patches config with a valid `color_scheme` value
- **THEN** the server persists that value and subsequent GET config returns it

#### Scenario: Reject invalid color scheme

- **WHEN** the client patches config with an invalid `color_scheme` value
- **THEN** the server rejects the request and does not change the stored value

### Requirement: Theme selection in Appearance settings

The Appearance settings pane SHALL let the user choose Light, Dark, or Auto (system).

#### Scenario: Select light

- **WHEN** the user selects Light
- **THEN** the UI and terminal use the light theme and config `color_scheme` becomes `light`

#### Scenario: Select dark

- **WHEN** the user selects Dark
- **THEN** the UI and terminal use the dark theme and config `color_scheme` becomes `dark`

#### Scenario: Select auto

- **WHEN** the user selects Auto
- **THEN** config `color_scheme` becomes `system` and the resolved theme follows the OS preference

### Requirement: Resolve system preference

When `color_scheme` is `system`, the system SHALL resolve the active theme from the OS `prefers-color-scheme` preference and update when that preference changes.

#### Scenario: Follow OS dark preference

- **WHEN** `color_scheme` is `system` and the OS preference is dark
- **THEN** the active theme is dark

#### Scenario: Follow OS light preference

- **WHEN** `color_scheme` is `system` and the OS preference is light
- **THEN** the active theme is light

#### Scenario: OS preference changes while system is selected

- **WHEN** `color_scheme` is `system` and the OS preference changes between light and dark
- **THEN** the active UI and terminal themes update to match without requiring a reload

### Requirement: Apply theme to chrome and terminal

The resolved theme (light or dark) SHALL apply to application chrome styles and the xterm theme.

#### Scenario: Chrome uses theme tokens

- **WHEN** the resolved theme is light or dark
- **THEN** application chrome colors are taken from the corresponding theme tokens

#### Scenario: Terminal matches resolved theme

- **WHEN** the resolved theme changes
- **THEN** the xterm theme updates to match the resolved theme

