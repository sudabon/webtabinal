# transport-api Specification

## Purpose
TBD - created by archiving change lterm-v01. Update Purpose after archive.
## Requirements
### Requirement: REST session and config API
The daemon SHALL expose REST endpoints under `/api`: list/create/duplicate/restart/delete sessions, reorder sessions, and get/patch config. Create MAY accept optional `cwd` (default `~`).

#### Scenario: Create session
- **WHEN** the client `POST /api/sessions` without cwd
- **THEN** a new session is created with CWD home and appears in subsequent list responses

#### Scenario: Reorder sessions
- **WHEN** the client `PUT /api/sessions/order` with an ordered `ids` array
- **THEN** the daemon persists that order for list and WS session sync

#### Scenario: Patch config
- **WHEN** the client `PATCH /api/config` with a partial settings object
- **THEN** the config file is updated and subsequent `GET /api/config` reflects the change

### Requirement: Multiplexed WebSocket protocol
The system SHALL use a single WebSocket at `/api/ws` with JSON text frames and base64 payloads. Client messages MUST include `attach`, `input`, and `resize`. Server messages MUST include chunked `replay`, live `output` (attached sessions only), `state` for all sessions, and `sessions` list sync on create/delete/reorder.

#### Scenario: Attach replays then streams
- **WHEN** the client sends `attach` (and `resize`) for a session
- **THEN** the server sends one or more `replay` frames covering the ring buffer followed by live `output` for that session

#### Scenario: State is broadcast for all sessions
- **WHEN** any session’s CWD, command, or state changes
- **THEN** a `state` message is sent on the WebSocket even if that session is not attached

#### Scenario: Output only for attached session
- **WHEN** an unattached session produces PTY output
- **THEN** no `output` message is sent for that session until it is attached

### Requirement: Client reconnect with exponential backoff
On WebSocket disconnect the client SHALL reconnect with exponential backoff starting at 0.5s capped at 5s, then re-attach with reset + replay.

#### Scenario: Disconnect triggers backoff reconnect
- **WHEN** the WebSocket closes unexpectedly
- **THEN** the client attempts reconnection with delays that grow from 0.5s up to 5s until success

### Requirement: Localhost Host Origin and token authentication
The daemon SHALL reject API and WebSocket requests whose Host/Origin are not `localhost:<port>` or `127.0.0.1:<port>`. It SHALL generate a token on first start, store it in config, set it as a `SameSite=Strict` cookie on first frontend GET, and validate it on REST and WS handshake. An auth middleware seam SHALL exist for future remote auth.

#### Scenario: Foreign Origin is rejected
- **WHEN** a request arrives with an Origin other than the loopback daemon origin
- **THEN** the request is rejected and no session API is executed

#### Scenario: Missing token is rejected
- **WHEN** a REST or WS request lacks a valid auth token cookie
- **THEN** the daemon responds with an authentication failure

### Requirement: Session memo in API payloads

Session list, create, duplicate, restart, and WebSocket `sessions` payloads SHALL include `memo` (string, empty when unset).

#### Scenario: List includes memo

- **WHEN** the client `GET /api/sessions` and a session has memo `CI watch`
- **THEN** that session object includes `"memo": "CI watch"`

### Requirement: Patch session memo

The daemon SHALL accept `PATCH /api/sessions/{id}` with JSON `{ "memo": "<string>" }`. The value SHALL be trimmed; more than 30 Unicode code points SHALL be rejected with 400. A successful patch SHALL persist the memo on the session, return the updated session, and broadcast the session list on the WebSocket.

#### Scenario: Successful memo patch

- **WHEN** the client `PATCH /api/sessions/{id}` with `{ "memo": " CI watch " }` for an existing session
- **THEN** the response session has `"memo": "CI watch"` and subsequent list/WS payloads match

#### Scenario: Over-limit memo is rejected

- **WHEN** the client `PATCH /api/sessions/{id}` with a memo longer than 30 Unicode code points
- **THEN** the daemon responds 400 and the session memo is unchanged

#### Scenario: Missing session is rejected

- **WHEN** the client `PATCH /api/sessions/{id}` for an unknown id
- **THEN** the daemon responds with a client error and no session is created

### Requirement: Ephemeral notify WebSocket message

The server SHALL broadcast `notify` frames on `/api/ws` to all connected clients when an OSC 9 or OSC 99 notify event is parsed. The frame SHALL be `{"t":"notify","sid":"<id>","title":"<string>","body":"<string>"}`. Empty title and body SHALL NOT produce a frame. The message SHALL NOT require the client to be attached to that session and SHALL NOT change the session `state` payload.

#### Scenario: Notify is broadcast without attach

- **WHEN** a session that no client has attached emits OSC 9 with message `needs approval`
- **THEN** every connected WebSocket client receives `t=notify` for that `sid` with a non-empty `body`

#### Scenario: Notify does not idle the session

- **WHEN** a `running` session emits OSC 99
- **THEN** subsequent `state` messages still report `running` for that session

