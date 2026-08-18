## ADDED Requirements

### Requirement: Notify on agent blocked transition

When agent state changes from any non-blocked state to `blocked`, the system SHALL create an agent-attention notification event if `state.notify_on_blocked` and `notification.enabled` are true. The event SHALL use the existing platform notification provider and unread-mark behavior, SHALL obey `notification.always`, and SHALL NOT be suppressed by `notification.min_duration_ms`.

#### Scenario: Background blocked state notifies
- **WHEN** a background session changes from `working` to `blocked` with blocked notifications enabled
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

### Requirement: Agent attention notifications are deduplicated across signals

The daemon SHALL deduplicate OSC 9, OSC 99, OSC 777, and screen-derived blocked notification events by session within a four-second monotonic window. The first eligible event SHALL be emitted immediately; later events in that window SHALL suppress only duplicate notification delivery and SHALL NOT suppress state transitions.

#### Scenario: OSC arrives before screen detection
- **WHEN** an OSC wait event is emitted and the same session enters screen-detected `blocked` two seconds later
- **THEN** only the OSC-origin notification is delivered while the blocked state transition is still broadcast

#### Scenario: Screen detection arrives before OSC
- **WHEN** a screen-derived blocked event is emitted and the same session sends OSC 9 one second later
- **THEN** only the screen-origin notification is delivered

#### Scenario: Different sessions are independent
- **WHEN** two sessions each produce an agent-attention event within four seconds
- **THEN** each session can deliver one notification

#### Scenario: Later attention event can notify
- **WHEN** a session produces another eligible agent-attention event after the four-second window
- **THEN** the later event is not suppressed by the earlier timestamp

### Requirement: Disabling state detection preserves OSC notifications

When `state.enabled` changes to false, the system SHALL stop screen-derived state evaluation and blocked notifications, reset live agent states to `none`, and continue parsing and delivering existing OSC notifications.

#### Scenario: Disable clears a visible state
- **WHEN** state detection is disabled while a session is `blocked`
- **THEN** clients receive an agent state update to `none` and no further screen-derived blocked notifications occur

#### Scenario: OSC remains active while detection is disabled
- **WHEN** a session emits OSC 9 while `state.enabled` is false and notifications are otherwise eligible
- **THEN** the existing OSC wait notification is still delivered

#### Scenario: Re-enable evaluates live sessions
- **WHEN** state detection is re-enabled while sessions remain live
- **THEN** the daemon evaluates their current observations and broadcasts any newly detected agent states
