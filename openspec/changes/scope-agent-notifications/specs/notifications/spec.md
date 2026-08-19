## ADDED Requirements

### Requirement: Desktop notifications are limited to whitelisted commands

Every desktop notification SHALL be raised only when the session's command is permitted by `notification.commands`. This applies uniformly to command completion, OSC wait, screen-derived `blocked`, and prompt-return notifications, so a single list determines which sessions can produce a banner.

A command SHALL be permitted when the basename of the first whitespace-separated token of the session's command equals an entry in the list, ignoring case. An empty list SHALL disable the restriction so every session may notify. Suppressing all notifications SHALL remain the job of `notification.enabled`.

A restricted event SHALL still mark the session unread and update the Dock badge, so nothing is lost when the banner is withheld.

#### Scenario: Whitelisted command notifies on completion

- **WHEN** `notification.commands` contains `make`, a session runs `make build`, and the completion is otherwise eligible
- **THEN** one platform notification is requested

#### Scenario: Unlisted command does not notify on completion

- **WHEN** `notification.commands` is `["claude"]` and a session runs `ls` to completion while notifications are enabled and `notification.always` is true
- **THEN** no platform notification is requested and the tab is still marked unread if it is not active

#### Scenario: Path and arguments are ignored when matching

- **WHEN** `notification.commands` contains `claude` and a session runs `/usr/local/bin/claude --resume`
- **THEN** the command is permitted

#### Scenario: Unlisted command does not notify on agent events

- **WHEN** `notification.commands` is `["claude"]` and a session running `codex` emits OSC 9 or enters `blocked`
- **THEN** no platform notification is requested and the tab is still marked unread if it is not active

#### Scenario: Case does not decide whether a notification appears

- **WHEN** `notification.commands` contains `Task` and a session runs `task`
- **THEN** the command is permitted

#### Scenario: Empty list disables the restriction

- **WHEN** `notification.commands` is empty and any session produces an eligible notification event
- **THEN** the notification is raised as it would have been without the list

#### Scenario: Unknown command does not notify

- **WHEN** a session has no known command and produces an eligible notification event while `notification.commands` is non-empty
- **THEN** no platform notification is requested

### Requirement: Notify on agent prompt return

When agent state changes from `working` to `idle`, the system SHALL create an agent-attention notification event if `notification.enabled` is true. This event represents the agent returning its prompt at the end of a turn. It SHALL reuse the existing platform notification provider, unread-mark, activation, `notification.always`, and command-whitelist behavior, and SHALL NOT be suppressed by `notification.min_duration_ms`. Its title SHALL be the agent display name and its body SHALL state that the agent is ready for input.

Transitions into `idle` from `none` or from `blocked` SHALL NOT create this event, because the first is a session's initial idle-safe resolution and the second follows a user response that has just occurred.

#### Scenario: Background turn completion notifies

- **WHEN** a background session running a whitelisted `cursor-agent` changes from `working` to `idle`
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

### Requirement: Notify on command completion
When a command completes (`OSC 133;D` or fallback running→idle), the system SHALL raise a desktop notification if notifications are enabled, the session's command is permitted by `notification.commands`, and the event passes the suppression and duration rules. Default suppression: do not notify when the completing tab is active AND the app window is focused, unless `notification.always` is true. Completions shorter than `notification.min_duration_ms` SHALL be skipped. Notification title SHALL use ✓ or ✗ with the command; body SHALL include directory basename and duration. Click SHALL focus the window and switch to that tab. Sound SHALL NOT play in v0.1 (`sound` key reserved).

#### Scenario: Background completion notifies
- **WHEN** a whitelisted command completes on a non-active tab (or the window is unfocused) and notifications are enabled
- **THEN** a macOS notification is shown with command and duration

#### Scenario: Active focused completion is suppressed by default
- **WHEN** a command completes on the active tab while the window is focused and `notification.always` is false
- **THEN** no desktop notification is shown

#### Scenario: Short commands respect min duration
- **WHEN** `notification.min_duration_ms` is 5000 and a command finishes in 1s
- **THEN** no notification is emitted for that completion

#### Scenario: Unlisted command is suppressed regardless of duration
- **WHEN** `notification.min_duration_ms` is 0, `notification.always` is true, and a session runs a command that is not in `notification.commands`
- **THEN** no desktop notification is shown

### Requirement: Notify on agent wait OSC

When the daemon reports an OSC 9, OSC 99, or OSC 777 notify event, the client SHALL raise a desktop notification if notifications are enabled, the session's command is permitted by `notification.commands`, and the event passes the same default suppression as command completion: do not notify when the tab is active AND the app window is focused, unless `notification.always` is true. `notification.min_duration_ms` SHALL NOT skip agent-wait notifications. Notification title and body SHALL come from the OSC payload (title MAY fall back to the session command or `WebTabinal`). Click SHALL focus the window and switch to that tab. Sound SHALL NOT play (`sound` key reserved).

#### Scenario: Background wait notifies

- **WHEN** an OSC notify arrives for a non-active tab running a whitelisted command (or the window is unfocused) and notifications are enabled
- **THEN** a macOS notification is shown with the OSC title and body

#### Scenario: Active focused wait is suppressed by default

- **WHEN** an OSC notify arrives for the active tab while the window is focused and `notification.always` is false
- **THEN** no desktop notification is shown

#### Scenario: Wait ignores min duration

- **WHEN** `notification.min_duration_ms` is 5000 and an OSC notify arrives 1s after the command started
- **THEN** the wait notification is still emitted (subject to focus suppression)

### Requirement: Unread mark on agent wait

A wait notification on a non-active tab SHALL mark that tab unread and increment the Dock badge, using the same clear-on-activate behavior as completion unread marks. This SHALL apply whether the notification was shown, suppressed by focus rules, or suppressed by the command whitelist.

#### Scenario: Background wait marks unread

- **WHEN** an OSC notify arrives for a non-active tab
- **THEN** that tab shows an unread dot and the Dock badge count increases by one if it was not already unread

#### Scenario: Whitelist-suppressed wait still marks unread

- **WHEN** an OSC notify arrives for a non-active tab whose command is not in `notification.commands`
- **THEN** that tab shows an unread dot and no desktop notification is shown

### Requirement: Notify on agent blocked transition

When agent state changes from any non-blocked state to `blocked`, the system SHALL create an agent-attention notification event if `state.notify_on_blocked` and `notification.enabled` are true. The event SHALL use the existing platform notification provider and unread-mark behavior, SHALL obey `notification.always` and `notification.commands`, and SHALL NOT be suppressed by `notification.min_duration_ms`.

#### Scenario: Background blocked state notifies
- **WHEN** a background session running a whitelisted command changes from `working` to `blocked` with blocked notifications enabled
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
