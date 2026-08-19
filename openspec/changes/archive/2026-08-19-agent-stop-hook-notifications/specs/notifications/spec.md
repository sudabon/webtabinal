## ADDED Requirements

### Requirement: Agents report turn completion through a hook

The system SHALL accept a turn-completion notification reported by a coding agent's stop hook and treat it as an agent-attention event. The event SHALL reuse the existing platform notification provider, unread-mark, activation, `notification.always`, `notification.commands`, and cross-signal dedupe behavior, and SHALL NOT be suppressed by `notification.min_duration_ms`.

A hook process SHALL be able to report the event without access to the terminal, because a stop hook on both Claude Code and cursor-agent runs without a controlling terminal. The session it belongs to SHALL be identified by `WEBTABINAL_SESSION_ID`, which the session environment already provides and hook processes inherit.

A report naming a session that no longer exists SHALL be discarded without error, so a hook firing during shutdown does not fail the agent's turn.

#### Scenario: Stop hook notifies on turn completion

- **WHEN** an agent's stop hook reports turn completion for a live session whose command is permitted by `notification.commands`
- **THEN** one platform notification is requested and the session is marked unread if it is not active

#### Scenario: Hook report needs no terminal

- **WHEN** a stop hook that cannot open `/dev/tty` reports turn completion
- **THEN** the notification is delivered

#### Scenario: Report for a closed session is discarded

- **WHEN** a stop hook reports turn completion for a session that has already exited
- **THEN** no notification event is created and the reporting command succeeds

#### Scenario: Hook report obeys the command whitelist

- **WHEN** a stop hook reports turn completion for a session whose command is not in `notification.commands`
- **THEN** no platform banner is requested and the session is still marked unread if it is not active

#### Scenario: Hook report is deduplicated against other signals

- **WHEN** a session emits OSC 9 on turn completion and its stop hook reports the same completion one second later
- **THEN** only one notification is delivered

## MODIFIED Requirements

### Requirement: Notify on agent prompt return

When agent state changes from `working` to `idle`, the system SHALL create an agent-attention notification event only if `state.notify_on_idle` is true. This screen-derived event SHALL default to disabled, because output quiescence cannot distinguish a finished turn from an agent that has merely paused, and an agent's stop hook reports the same thing exactly. When enabled it SHALL reuse the existing platform notification provider, unread-mark, activation, `notification.always`, and command-whitelist behavior, and SHALL NOT be suppressed by `notification.min_duration_ms`. Its title SHALL be the agent display name and its body SHALL state that the agent is ready for input.

Transitions into `idle` from `none` or from `blocked` SHALL NOT create this event, because the first is a session's initial idle-safe resolution and the second follows a user response that has just occurred.

#### Scenario: Screen-derived prompt return is off by default

- **WHEN** a session changes from `working` to `idle` on a configuration that has never set `state.notify_on_idle`
- **THEN** the state pill updates and no notification event is created

#### Scenario: Background turn completion notifies

- **WHEN** `state.notify_on_idle` is true and a background session running a whitelisted `cursor-agent` changes from `working` to `idle`
- **THEN** the session is marked unread and one platform notification is requested

#### Scenario: Session start does not notify

- **WHEN** a newly identified agent session resolves from `none` to `idle`
- **THEN** the state pill updates and no notification event is created

#### Scenario: Answering an approval does not notify

- **WHEN** a session changes from `blocked` to `idle`
- **THEN** the state pill updates and no notification event is created

#### Scenario: Active focused prompt return respects always

- **WHEN** `state.notify_on_idle` is true, the active session returns its prompt while the window is focused, and `notification.always` is false
- **THEN** the state pill updates and no platform banner is requested

#### Scenario: Prompt return ignores command duration threshold

- **WHEN** `state.notify_on_idle` is true, `notification.min_duration_ms` is greater than zero, and an agent returns its prompt sooner than that threshold
- **THEN** the prompt-return notification remains eligible because it is an attention event rather than command completion

#### Scenario: Repeated idle evidence does not notify again

- **WHEN** `state.notify_on_idle` is true and detector evaluations repeatedly confirm a session that is already `idle`
- **THEN** no additional prompt-return notification event is created until the session leaves and later re-enters `idle` from `working`
