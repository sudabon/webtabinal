## ADDED Requirements

### Requirement: Ephemeral notify WebSocket message

The server SHALL broadcast `notify` frames on `/api/ws` to all connected clients when an OSC 9 or OSC 99 notify event is parsed. The frame SHALL be `{"t":"notify","sid":"<id>","title":"<string>","body":"<string>"}`. Empty title and body SHALL NOT produce a frame. The message SHALL NOT require the client to be attached to that session and SHALL NOT change the session `state` payload.

#### Scenario: Notify is broadcast without attach

- **WHEN** a session that no client has attached emits OSC 9 with message `needs approval`
- **THEN** every connected WebSocket client receives `t=notify` for that `sid` with a non-empty `body`

#### Scenario: Notify does not idle the session

- **WHEN** a `running` session emits OSC 99
- **THEN** subsequent `state` messages still report `running` for that session
