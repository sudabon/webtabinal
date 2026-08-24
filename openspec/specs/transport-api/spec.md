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

The server SHALL broadcast `notify` frames on `/api/ws` to all connected clients when an OSC 9, OSC 99, or OSC 777 notify event is parsed. The frame SHALL be `{"t":"notify","sid":"<id>","title":"<string>","body":"<string>"}` with optional `kind` and `source` fields. Empty title and body SHALL NOT produce a frame. `OSC 9;4;…` and `OSC 9;9;…` payloads SHALL NOT produce a frame. The message SHALL NOT require the client to be attached to that session and SHALL NOT change the session `state` payload.

Whether a frame raises a desktop banner SHALL be decided by the client from `notification.commands` and the session's command, so the daemon SHALL broadcast eligible frames regardless of that setting.

#### Scenario: Notify is broadcast without attach

- **WHEN** a session that no client has attached emits OSC 9 with message `needs approval`
- **THEN** every connected WebSocket client receives `t=notify` for that `sid` with a non-empty `body`

#### Scenario: Notify does not idle the session

- **WHEN** a `running` session emits OSC 99
- **THEN** subsequent `state` messages still report `running` for that session

#### Scenario: ConEmu progress produces no frame

- **WHEN** a session emits `OSC 9;4;1;40`
- **THEN** no `t=notify` frame is broadcast for that session

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

### Requirement: Authenticated session state snapshot endpoint

The daemon SHALL expose `GET /api/sessions/{id}/state-snapshot` on the existing loopback server. It SHALL require the existing token authentication and Host/Origin checks, accept `lines` in the range 1–200 and `buffer` equal to `active`, `primary`, or `alternate`, and return a read-only JSON diagnostic snapshot.

#### Scenario: Bearer-authenticated CLI request succeeds
- **WHEN** a request uses the configured loopback Host, has no foreign Origin, carries the valid token as `Authorization: Bearer`, and names a live session
- **THEN** the endpoint returns the requested screen and agent-match diagnostics

#### Scenario: Missing token is rejected
- **WHEN** a snapshot request omits both the valid cookie and bearer token
- **THEN** the endpoint responds with an authentication failure and no diagnostic content

#### Scenario: Invalid snapshot query is rejected
- **WHEN** `lines` is outside 1–200 or `buffer` is not an allowed selector
- **THEN** the endpoint responds 400 without changing the session

#### Scenario: Unknown session returns not found
- **WHEN** the path names a session that does not exist
- **THEN** the endpoint responds 404 and does not create a session

#### Scenario: Unavailable model is structured
- **WHEN** the session exists but its screen model is unavailable
- **THEN** the endpoint responds with a structured unavailable error and does not return stale screen lines as current

### Requirement: State snapshot response is bounded and non-mutating

The snapshot response SHALL contain session ID, selected buffer, rows, columns, at most the requested number of normalized bottom lines, current agent identity/state/since/signal, selected manifest and verified versions, matched state pattern IDs and line indexes, and component availability. It MUST NOT contain scrollback beyond the visible grid or provide any mutation operation.

#### Scenario: Response contains match identity rather than hidden mutation
- **WHEN** a blocked pattern matches a visible line
- **THEN** the response identifies the manifest pattern and line index while the request sends no input and changes no detector state

#### Scenario: Requested line bound is enforced
- **WHEN** a 200-row screen is requested with `lines=15`
- **THEN** the response contains no more than the final 15 visible rows

#### Scenario: Diagnostic contents are not logged
- **WHEN** a successful or failed snapshot request is handled
- **THEN** daemon logs can record request metadata and errors but do not record returned screen lines, match substrings, or the bearer token

### Requirement: Agent prompt-return notification metadata

A prompt-return notification SHALL use the existing `notify` WebSocket frame and SHALL add `kind: "agent_idle"` and `source: "screen"` without removing `sid`, `title`, or `body`. The title SHALL be the agent display name and the body SHALL state that the agent is ready for input. Clients SHALL be able to ignore the additive metadata.

#### Scenario: Prompt return uses the existing frame family

- **WHEN** an agent session changes from `working` to `idle` and the notification arbiter admits the event
- **THEN** clients receive one `t=notify` frame with the session, agent display name as title, a body stating the agent is ready for input, `kind=agent_idle`, and `source=screen`

#### Scenario: Older client remains compatible

- **WHEN** an older client receives an `agent_idle` notify frame
- **THEN** it can continue handling `sid`, `title`, and `body` as before

### Requirement: Authenticated session notification endpoint

The daemon SHALL expose `POST /api/sessions/{id}/notify` on the existing loopback server. It SHALL require the existing token authentication and Host/Origin checks. The request body SHALL accept `title`, `body`, and an optional `kind`, and SHALL reject a body whose `title` and `body` are both blank.

On success the daemon SHALL broadcast the existing `notify` frame for that session with `source: "hook"` and the given `kind`, defaulting `kind` to `agent_idle`. A request naming an unknown session SHALL return success without broadcasting, so a hook racing session teardown does not fail.

#### Scenario: Authenticated hook report broadcasts a notify frame

- **WHEN** a request carries the valid token, names a live session, and supplies a body
- **THEN** every connected WebSocket client receives one `t=notify` frame for that session with `source=hook`

#### Scenario: Default kind is the prompt return

- **WHEN** a request omits `kind`
- **THEN** the broadcast frame carries `kind=agent_idle`

#### Scenario: Unknown session is accepted without broadcasting

- **WHEN** a request names a session that does not exist
- **THEN** the daemon responds with success and no frame is broadcast

#### Scenario: Blank report is rejected

- **WHEN** a request supplies neither a title nor a body
- **THEN** the daemon responds with a client error and no frame is broadcast

#### Scenario: Unauthenticated report is refused

- **WHEN** a request omits the token or presents a foreign Origin
- **THEN** the daemon refuses it with the same status the other API routes use and no frame is broadcast

### Requirement: Authenticated session image upload endpoint

The daemon SHALL expose `POST /api/sessions/{id}/images` on the existing loopback server, requiring the existing token authentication and Host/Origin checks. The request body SHALL be the raw image bytes. The daemon SHALL determine the media type from the bytes themselves, never from the request's `Content-Type`, and SHALL accept only PNG, JPEG, GIF, and WebP. It SHALL reject a body over 10 MiB.

On success it SHALL write the bytes to a file under the images directory and respond with that file's absolute `path`, `name`, `mime`, and `bytes`. The generated name SHALL contain no character that would need shell quoting, because the client types the path straight into the PTY.

#### Scenario: Authenticated upload returns a readable path

- **WHEN** a request carries the valid token, names a live session, and supplies PNG bytes
- **THEN** the daemon responds with the path of a file holding exactly those bytes

#### Scenario: Media type comes from the bytes

- **WHEN** a request supplies bytes that are not one of the accepted image formats
- **THEN** the daemon refuses it as an unsupported media type and writes no file, whatever `Content-Type` the request declared

#### Scenario: Oversized upload is refused

- **WHEN** a request body exceeds the size limit
- **THEN** the daemon refuses it as too large

#### Scenario: Unknown session is refused

- **WHEN** a request names a session that does not exist
- **THEN** the daemon responds not found and writes no file

#### Scenario: Unauthenticated upload is refused

- **WHEN** a request omits the token or presents a foreign Origin
- **THEN** the daemon refuses it with the same status the other API routes use and writes no file

### Requirement: Pasted image retention

Images stored by the upload endpoint SHALL live under the application support directory and SHALL be removed once older than seven days. Pruning SHALL run when an image is stored and when the daemon starts, and SHALL delete only files matching the generated name pattern so unrelated files in the same directory survive.

#### Scenario: Stale generated image is pruned

- **WHEN** a stored image is older than the retention window and a prune runs
- **THEN** that file is deleted

#### Scenario: Unrelated file is left alone

- **WHEN** a file the daemon did not generate sits in the images directory and a prune runs
- **THEN** that file is still present
