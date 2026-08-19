## ADDED Requirements

### Requirement: Agent prompt-return notification metadata

A prompt-return notification SHALL use the existing `notify` WebSocket frame and SHALL add `kind: "agent_idle"` and `source: "screen"` without removing `sid`, `title`, or `body`. The title SHALL be the agent display name and the body SHALL state that the agent is ready for input. Clients SHALL be able to ignore the additive metadata.

#### Scenario: Prompt return uses the existing frame family

- **WHEN** a permitted agent session changes from `working` to `idle` and the notification arbiter admits the event
- **THEN** clients receive one `t=notify` frame with the session, agent display name as title, a body stating the agent is ready for input, `kind=agent_idle`, and `source=screen`

#### Scenario: Older client remains compatible

- **WHEN** an older client receives an `agent_idle` notify frame
- **THEN** it can continue handling `sid`, `title`, and `body` as before

## MODIFIED Requirements

### Requirement: Ephemeral notify WebSocket message

The server SHALL broadcast `notify` frames on `/api/ws` to all connected clients when an OSC 9, OSC 99, or OSC 777 notify event is parsed. The frame SHALL be `{"t":"notify","sid":"<id>","title":"<string>","body":"<string>"}` with optional `kind`, `source`, and `banner` fields. Empty title and body SHALL NOT produce a frame. `OSC 9;4;…` and `OSC 9;9;…` payloads SHALL NOT produce a frame. The message SHALL NOT require the client to be attached to that session and SHALL NOT change the session `state` payload.

The optional `banner` field SHALL be `false` when the event is restricted by the configured agent allow list and SHALL be omitted otherwise. A frame with `banner: false` SHALL still mark the session unread and SHALL NOT raise a platform notification. A client that does not understand `banner` SHALL keep its previous behavior.

#### Scenario: Notify is broadcast without attach

- **WHEN** a session that no client has attached emits OSC 9 with message `needs approval`
- **THEN** every connected WebSocket client receives `t=notify` for that `sid` with a non-empty `body`

#### Scenario: Notify does not idle the session

- **WHEN** a `running` session emits OSC 99
- **THEN** subsequent `state` messages still report `running` for that session

#### Scenario: Restricted notify carries a banner flag

- **WHEN** a session whose agent is not permitted by `state.notify_agents` emits OSC 9
- **THEN** clients receive one `t=notify` frame for that `sid` with `banner` equal to `false`

#### Scenario: ConEmu progress produces no frame

- **WHEN** a session emits `OSC 9;4;1;40`
- **THEN** no `t=notify` frame is broadcast for that session
