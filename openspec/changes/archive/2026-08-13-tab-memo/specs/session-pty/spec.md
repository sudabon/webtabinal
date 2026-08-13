## ADDED Requirements

### Requirement: Session memo field

Each session SHALL have a memo string of at most 30 Unicode code points (empty allowed). New sessions SHALL start with an empty memo. Duplicate SHALL NOT copy the source memo. Restart SHALL copy the source memo onto the replacement session.

#### Scenario: New session has empty memo

- **WHEN** a session is created
- **THEN** its memo is empty

#### Scenario: Duplicate does not copy memo

- **WHEN** the user duplicates a session whose memo is `CI watch`
- **THEN** the new session has an empty memo

#### Scenario: Restart preserves memo

- **WHEN** the user restarts an exited session whose memo is `CI watch`
- **THEN** the replacement session has memo `CI watch`
