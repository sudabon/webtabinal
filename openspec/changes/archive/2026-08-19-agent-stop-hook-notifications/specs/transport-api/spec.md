## ADDED Requirements

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
