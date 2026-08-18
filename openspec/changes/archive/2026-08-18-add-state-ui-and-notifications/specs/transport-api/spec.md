## ADDED Requirements

### Requirement: Agent state in session snapshots

Every session object returned by `GET /api/sessions` or a WebSocket `sessions` frame SHALL include `agent` (manifest ID or empty string), `agent_state` (`none`, `idle`, `working`, or `blocked`), `agent_state_since` (RFC 3339 timestamp), `agent_state_signal` (signal ID or empty string), and optional `agent_state_detail` containing non-sensitive pattern metadata. These fields SHALL describe daemon state at the time the snapshot is created.

#### Scenario: Reconnect restores current blocked state
- **WHEN** a client connects after an unattached session has already become `blocked`
- **THEN** the initial `sessions` frame includes that session's agent identity, `blocked` state, state-entry timestamp, and source signal without waiting for a new transition

#### Scenario: Ordinary shell has an explicit none state
- **WHEN** the session list contains a shell with no detected agent
- **THEN** its session object has an empty `agent`, `agent_state` equal to `none`, and no captured terminal text in its diagnostic fields

### Requirement: Agent state WebSocket transitions

The server SHALL broadcast `agent_state` frames on `/api/ws` as `{"t":"agent_state","sid":"<id>","agent":"<manifest-id>","agent_state":"<state>","agent_state_since":"<rfc3339>","agent_state_signal":"<signal>"}` with optional `agent_state_detail`. It SHALL broadcast identity or state transitions to every connected client regardless of attachment and SHALL keep the existing shell `state` frame unchanged.

#### Scenario: Unattached session broadcasts blocked
- **WHEN** an unattached session changes from agent state `working` to `blocked`
- **THEN** every connected client receives one `t=agent_state` frame for that session

#### Scenario: Repeated evidence does not duplicate the frame
- **WHEN** repeated detector evaluations confirm the same agent identity and state
- **THEN** the server does not broadcast another `agent_state` frame

#### Scenario: Shell and agent state coexist
- **WHEN** a session has shell state `running` and agent state `idle`
- **THEN** its existing `state` frame still reports `running` and its agent snapshot or `agent_state` frame separately reports `idle`

#### Scenario: Initial snapshot precedes queued transition
- **WHEN** agent state changes while a newly connected client is receiving its initial session sync
- **THEN** the client's send queue orders the initial `sessions` snapshot before the later `agent_state` transition so the final reduced state is current

### Requirement: Agent blocked notification metadata

A screen-derived blocked notification SHALL use the existing `notify` WebSocket frame and SHALL add `kind: "agent_blocked"` and `source: "screen"` without removing `sid`, `title`, or `body`. Existing OSC notify frames SHALL remain valid, and clients SHALL be able to ignore the additive metadata.

#### Scenario: Blocked notification uses the existing frame family
- **WHEN** the notification arbiter emits a screen-derived agent blocked notification
- **THEN** clients receive one `t=notify` frame with the session, title, body, `kind=agent_blocked`, and `source=screen`

#### Scenario: Existing OSC client remains compatible
- **WHEN** an older client receives a notify frame with the new optional fields
- **THEN** it can continue handling `sid`, `title`, and `body` as before
