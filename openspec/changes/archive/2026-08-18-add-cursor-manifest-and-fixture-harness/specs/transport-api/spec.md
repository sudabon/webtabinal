## ADDED Requirements

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
