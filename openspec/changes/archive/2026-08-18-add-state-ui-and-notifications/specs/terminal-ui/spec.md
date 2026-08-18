## ADDED Requirements

### Requirement: Sidebar agent state pills

Each sidebar tab SHALL display a separate agent state pill when `agent_state` is `idle`, `working`, or `blocked`, and SHALL omit the pill when the state is `none`. The pill SHALL identify the agent and state with text or an accessible name, SHALL use a muted idle treatment, an activity indicator for working, and a non-color-only attention treatment for blocked.

#### Scenario: Working agent is visible
- **WHEN** a Codex session has agent state `working`
- **THEN** its tab shows a Codex working pill with an activity indicator

#### Scenario: Blocked state is not color only
- **WHEN** a Claude Code session has agent state `blocked`
- **THEN** its tab exposes both a visible or accessible blocked label and an attention color

#### Scenario: Ordinary shell has no pill
- **WHEN** a session has agent state `none`
- **THEN** no agent state pill occupies space in its tab

### Requirement: Agent state coexists with existing tab information

The agent state pill SHALL NOT replace the tab's CWD, command, shell state, elapsed time, exit status, integration indicator, memo interaction, or unread completion mark. Agent state changes SHALL NOT reorder tabs or alter Cmd+number navigation order.

#### Scenario: Shell running and agent blocked are both shown
- **WHEN** a tab has shell state `running` and agent state `blocked`
- **THEN** the tab continues to show its running shell status and separately shows the blocked agent pill

#### Scenario: Unread survives blocked resolution
- **WHEN** a background blocked notification marks a tab unread and the agent later becomes `idle`
- **THEN** the unread mark remains until the user opens that tab while the pill updates to idle

#### Scenario: Blocked transition preserves order
- **WHEN** a lower tab changes to `blocked`
- **THEN** it remains in its daemon-authoritative position and existing drag and keyboard navigation order is unchanged

### Requirement: Agent state motion respects accessibility preferences

Working-state motion SHALL animate only compositor-friendly properties and SHALL stop when `prefers-reduced-motion: reduce` is active. Blocked state SHALL NOT use continuous flashing.

#### Scenario: Reduced motion disables the spinner
- **WHEN** the operating system requests reduced motion and an agent is working
- **THEN** the tab shows a static working indicator with the same accessible state label

#### Scenario: Blocked state does not flash
- **WHEN** an agent remains blocked
- **THEN** its attention treatment remains readable without a continuous flashing animation
