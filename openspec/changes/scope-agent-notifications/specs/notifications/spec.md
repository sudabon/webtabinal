## ADDED Requirements

### Requirement: Agent-attention notifications are limited to configured agents

The daemon SHALL restrict agent-attention notification banners to sessions whose detected agent is permitted by `state.notify_agents`. The setting SHALL hold manifest IDs. A non-empty list SHALL permit only the listed IDs. An empty list SHALL permit every identified agent while still excluding the generic manifest and unidentified sessions. When `state.enabled` is false the restriction SHALL NOT apply and every agent-attention event SHALL stay eligible.

A restricted event SHALL still be delivered to clients so the session is marked unread, but SHALL NOT raise a platform notification banner. Restriction SHALL NOT affect agent state transitions, the state pill, or command-completion notifications.

#### Scenario: Unidentified session does not raise a banner

- **WHEN** a session with no detected agent emits OSC 9 and `state.enabled` is true
- **THEN** no platform notification banner is requested and the session is still marked unread

#### Scenario: Generic TUI does not raise a banner

- **WHEN** a session detected as the generic manifest emits OSC 777 and `state.notify_agents` is empty
- **THEN** no platform notification banner is requested and the session is still marked unread

#### Scenario: Listed agent raises a banner

- **WHEN** a session detected as `claude` emits OSC 9 and `state.notify_agents` contains `claude`
- **THEN** one platform notification banner is requested

#### Scenario: Unlisted agent does not raise a banner

- **WHEN** a session detected as `codex` becomes `blocked` and `state.notify_agents` is `["claude"]`
- **THEN** no platform notification banner is requested and the session is still marked unread

#### Scenario: Empty list permits any identified agent

- **WHEN** a session detected as a locally installed manifest becomes `blocked` and `state.notify_agents` is empty
- **THEN** one platform notification banner is requested

#### Scenario: Disabled detection ignores the allow list

- **WHEN** `state.enabled` is false and any session emits OSC 9 while `state.notify_agents` is `["claude"]`
- **THEN** the OSC notification remains eligible and one platform notification banner is requested

#### Scenario: Command completion is unaffected

- **WHEN** a command completes on a session with no detected agent and completion notifications are eligible
- **THEN** the command-completion notification is delivered as before

### Requirement: Notify on agent prompt return

When agent state changes from `working` to `idle`, the system SHALL create an agent-attention notification event if `notification.enabled` is true and the agent is permitted by `state.notify_agents`. This event represents the agent returning its prompt at the end of a turn. It SHALL reuse the existing platform notification provider, unread-mark, activation, and `notification.always` behavior, and SHALL NOT be suppressed by `notification.min_duration_ms`. Its title SHALL be the agent display name and its body SHALL state that the agent is ready for input.

Transitions into `idle` from `none` or from `blocked` SHALL NOT create this event, because the first is a session's initial idle-safe resolution and the second follows a user response that has just occurred.

#### Scenario: Background turn completion notifies

- **WHEN** a background session detected as `cursor-agent` changes from `working` to `idle` and `cursor-agent` is permitted
- **THEN** the session is marked unread and one platform notification is requested

#### Scenario: Session start does not notify

- **WHEN** a newly identified agent session resolves from `none` to `idle`
- **THEN** the state pill updates and no notification event is created

#### Scenario: Answering an approval does not notify

- **WHEN** a session changes from `blocked` to `idle`
- **THEN** the state pill updates and no notification event is created

#### Scenario: Active focused prompt return respects always

- **WHEN** the active session returns its prompt while the window is focused and `notification.always` is false
- **THEN** the state pill updates and no platform banner is requested

#### Scenario: Prompt return ignores command duration threshold

- **WHEN** `notification.min_duration_ms` is greater than zero and an agent returns its prompt sooner than that threshold
- **THEN** the prompt-return notification remains eligible because it is an attention event rather than command completion

#### Scenario: Repeated idle evidence does not notify again

- **WHEN** detector evaluations repeatedly confirm a session that is already `idle`
- **THEN** no additional prompt-return notification event is created until the session leaves and later re-enters `idle` from `working`

### Requirement: ConEmu OSC 9 subcommands are not notifications

The daemon SHALL NOT treat `OSC 9;4;…` progress reports or `OSC 9;9;…` working-directory reports as notify events. Only `OSC 9` payloads that are not one of these reserved subcommands SHALL produce a notification event.

#### Scenario: Progress report is ignored

- **WHEN** a session emits `OSC 9;4;1;40`
- **THEN** no notify frame is produced and no session is marked unread

#### Scenario: Working-directory report is ignored

- **WHEN** a session emits `OSC 9;9;/Users/example/project`
- **THEN** no notify frame is produced and no session is marked unread

#### Scenario: Plain message still notifies

- **WHEN** a session emits `OSC 9;build finished`
- **THEN** a notify event with body `build finished` is produced

## MODIFIED Requirements

### Requirement: Notify on agent wait OSC

When the daemon reports an OSC 9, OSC 99, or OSC 777 notify event, the client SHALL raise a desktop notification if notifications are enabled, the event is not banner-suppressed by the configured agent allow list, and the event passes the same default suppression as command completion: do not notify when the tab is active AND the app window is focused, unless `notification.always` is true. `notification.min_duration_ms` SHALL NOT skip agent-wait notifications. Notification title and body SHALL come from the OSC payload (title MAY fall back to the session command or `WebTabinal`). Click SHALL focus the window and switch to that tab. Sound SHALL NOT play (`sound` key reserved).

#### Scenario: Background wait notifies

- **WHEN** an OSC notify arrives for a non-active tab of a permitted agent (or the window is unfocused) and notifications are enabled
- **THEN** a macOS notification is shown with the OSC title and body

#### Scenario: Active focused wait is suppressed by default

- **WHEN** an OSC notify arrives for the active tab while the window is focused and `notification.always` is false
- **THEN** no desktop notification is shown

#### Scenario: Wait ignores min duration

- **WHEN** `notification.min_duration_ms` is 5000 and an OSC notify arrives 1s after the command started
- **THEN** the wait notification is still emitted (subject to focus suppression)

#### Scenario: Banner-suppressed wait shows no notification

- **WHEN** an OSC notify arrives for a session whose agent is not permitted by `state.notify_agents`
- **THEN** no desktop notification is shown

### Requirement: Unread mark on agent wait

A wait notification on a non-active tab SHALL mark that tab unread and increment the Dock badge, using the same clear-on-activate behavior as completion unread marks. This SHALL apply whether the notification was shown, suppressed by focus rules, or banner-suppressed by the configured agent allow list.

#### Scenario: Background wait marks unread

- **WHEN** an OSC notify arrives for a non-active tab
- **THEN** that tab shows an unread dot and the Dock badge count increases by one if it was not already unread

#### Scenario: Banner-suppressed wait still marks unread

- **WHEN** an OSC notify arrives for a non-active tab whose agent is not permitted by `state.notify_agents`
- **THEN** that tab shows an unread dot and no desktop notification is shown

### Requirement: Notify on agent blocked transition

When agent state changes from any non-blocked state to `blocked`, the system SHALL create an agent-attention notification event if `state.notify_on_blocked` and `notification.enabled` are true. The event SHALL use the existing platform notification provider and unread-mark behavior, SHALL obey `notification.always`, and SHALL NOT be suppressed by `notification.min_duration_ms`. The banner SHALL be raised only when the detected agent is permitted by `state.notify_agents`.

#### Scenario: Background blocked state notifies
- **WHEN** a background session with a permitted agent changes from `working` to `blocked` with blocked notifications enabled
- **THEN** the session is marked unread and one platform notification is requested

#### Scenario: Active focused blocked state respects always
- **WHEN** the active session becomes blocked while the window is focused and `notification.always` is false
- **THEN** the state pill updates but no platform banner is requested

#### Scenario: Always allows foreground blocked notification
- **WHEN** the active focused session becomes blocked and `notification.always` is true
- **THEN** one platform notification is requested

#### Scenario: Blocked ignores command duration threshold
- **WHEN** `notification.min_duration_ms` is greater than zero and an agent becomes blocked immediately after starting
- **THEN** the blocked notification remains eligible because it is an attention event rather than command completion

#### Scenario: Repeated blocked evidence does not notify again
- **WHEN** detector evaluations repeatedly confirm a session that is already `blocked`
- **THEN** no additional blocked notification event is created until the session leaves and later re-enters `blocked`

#### Scenario: Blocked notifications can be disabled independently
- **WHEN** `state.notify_on_blocked` is false and agent state changes to `blocked`
- **THEN** the pill and state transport update but no screen-derived notification event is created

#### Scenario: Unpermitted agent blocked state shows no banner
- **WHEN** a session whose agent is not permitted by `state.notify_agents` becomes `blocked`
- **THEN** the session is marked unread and no platform banner is requested

### Requirement: Agent attention notifications are deduplicated across signals

The daemon SHALL deduplicate OSC 9, OSC 99, OSC 777, screen-derived blocked, and prompt-return notification events by session within a four-second monotonic window. The first eligible event SHALL be emitted immediately; later events in that window SHALL suppress only duplicate notification delivery and SHALL NOT suppress state transitions.

#### Scenario: OSC arrives before screen detection
- **WHEN** an OSC wait event is emitted and the same session enters screen-detected `blocked` two seconds later
- **THEN** only the OSC-origin notification is delivered while the blocked state transition is still broadcast

#### Scenario: Screen detection arrives before OSC
- **WHEN** a screen-derived blocked event is emitted and the same session sends OSC 9 one second later
- **THEN** only the screen-origin notification is delivered

#### Scenario: OSC arrives before prompt return
- **WHEN** a session emits OSC 9 on turn completion and its agent state changes from `working` to `idle` one second later
- **THEN** only the OSC-origin notification is delivered while the idle state transition is still broadcast

#### Scenario: Different sessions are independent
- **WHEN** two sessions each produce an agent-attention event within four seconds
- **THEN** each session can deliver one notification

#### Scenario: Later attention event can notify
- **WHEN** a session produces another eligible agent-attention event after the four-second window
- **THEN** the later event is not suppressed by the earlier timestamp

### Requirement: Disabling state detection preserves OSC notifications

When `state.enabled` changes to false, the system SHALL stop screen-derived state evaluation, blocked notifications, and prompt-return notifications, reset live agent states to `none`, and continue parsing and delivering existing OSC notifications without applying the `state.notify_agents` allow list.

#### Scenario: Disable clears a visible state
- **WHEN** state detection is disabled while a session is `blocked`
- **THEN** clients receive an agent state update to `none` and no further screen-derived blocked notifications occur

#### Scenario: OSC remains active while detection is disabled
- **WHEN** a session emits OSC 9 while `state.enabled` is false and notifications are otherwise eligible
- **THEN** the existing OSC wait notification is still delivered

#### Scenario: Re-enable evaluates live sessions
- **WHEN** state detection is re-enabled while sessions remain live
- **THEN** the daemon evaluates their current observations and broadcasts any newly detected agent states
