## ADDED Requirements

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
