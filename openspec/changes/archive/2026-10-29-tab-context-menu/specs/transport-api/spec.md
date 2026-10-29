# Spec Delta

## MODIFIED Requirements

### Requirement: Patch session memo

The daemon SHALL accept `PATCH /api/sessions/{id}` with a JSON object containing `memo` (string), `notifications_muted` (boolean), or both. At least one of the two fields SHALL be present; a body with neither SHALL be rejected with 400. A `memo` value SHALL be trimmed; more than 30 Unicode code points SHALL be rejected with 400. A field of the wrong JSON type SHALL be rejected with 400. A rejected request SHALL leave both the memo and the muted flag unchanged. A successful patch SHALL persist the provided fields on the session, leave omitted fields unchanged, return the updated session, and broadcast the session list on the WebSocket.

#### Scenario: Successful memo patch

- **WHEN** the client `PATCH /api/sessions/{id}` with `{ "memo": " CI watch " }` for an existing session
- **THEN** the response session has `"memo": "CI watch"` and subsequent list/WS payloads match

#### Scenario: Over-limit memo is rejected

- **WHEN** the client `PATCH /api/sessions/{id}` with a memo longer than 30 Unicode code points
- **THEN** the daemon responds 400 and the session memo is unchanged

#### Scenario: Missing session is rejected

- **WHEN** the client `PATCH /api/sessions/{id}` for an unknown id
- **THEN** the daemon responds with a client error and no session is created

#### Scenario: Mute patch leaves memo untouched

- **WHEN** a session has memo `CI watch` and the client `PATCH /api/sessions/{id}` with `{ "notifications_muted": true }`
- **THEN** the response session has `"notifications_muted": true` and `"memo": "CI watch"`, and the WebSocket `sessions` payload matches

#### Scenario: Invalid memo does not apply mute

- **WHEN** the client `PATCH /api/sessions/{id}` with `{ "memo": "<31 code points>", "notifications_muted": true }`
- **THEN** the daemon responds 400 and the session is still not muted

#### Scenario: Empty patch is rejected

- **WHEN** the client `PATCH /api/sessions/{id}` with `{}`
- **THEN** the daemon responds 400

## ADDED Requirements

### Requirement: Session notification mute in API payloads

Session list, create, duplicate, restart, and WebSocket `sessions` payloads SHALL include `notifications_muted` (boolean, `false` unless the session was muted).

#### Scenario: New session is not muted

- **WHEN** the client `POST /api/sessions`
- **THEN** the returned session object includes `"notifications_muted": false`

#### Scenario: List reflects a muted session

- **WHEN** a session was muted through the PATCH endpoint and the client `GET /api/sessions`
- **THEN** that session object includes `"notifications_muted": true`
