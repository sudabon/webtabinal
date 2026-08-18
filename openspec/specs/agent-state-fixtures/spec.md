# agent-state-fixtures Specification

## Purpose
TBD - created by archiving change add-cursor-manifest-and-fixture-harness. Update Purpose after archive.
## Requirements
### Requirement: Versioned raw PTY fixture format

Agent fixtures SHALL be stored by agent, exact version, and scenario. Each scenario SHALL contain raw PTY output bytes, validated capture metadata, and a case definition that maps byte ranges and virtual time advances to expected agent identity, state, signal, and transition count.

#### Scenario: Fixture preserves terminal control bytes
- **WHEN** a fixture containing alternate-screen and cursor control sequences is saved
- **THEN** its raw stream preserves the original bytes rather than a pre-rendered text snapshot

#### Scenario: Metadata is complete
- **WHEN** fixture validation runs
- **THEN** it rejects a scenario missing agent ID, exact version, rows, columns, TERM, locale, platform, scenario, or capture-tool version

#### Scenario: Timeline represents quiescence
- **WHEN** a case needs to test `working` to `idle`
- **THEN** its steps specify a virtual time advance long enough to exercise the manifest quiescence rule without using wall-clock sleeps

### Requirement: Controlled fixture recording workflow

The repository SHALL provide `scripts/record-agent-fixture.sh` to invoke `script(1)` with explicit agent ID, version, scenario, geometry, output destination, and agent command. It SHALL capture into a temporary location, validate size and metadata before promotion, warn that terminal contents can contain secrets, and refuse to overwrite an existing fixture unless an explicit overwrite option is supplied.

#### Scenario: New fixture is recorded
- **WHEN** a maintainer supplies all required identifiers and a valid agent command
- **THEN** the script records raw output and metadata in a temporary directory and promotes them only after recording and validation succeed

#### Scenario: Existing fixture is protected
- **WHEN** the destination scenario already exists and overwrite was not explicitly requested
- **THEN** the recorder exits non-zero without changing the existing fixture

#### Scenario: Oversized capture is rejected
- **WHEN** a capture exceeds the documented per-fixture size limit
- **THEN** the recorder does not promote it and explains how to capture a smaller controlled scenario

#### Scenario: Secret review is required
- **WHEN** recording finishes successfully
- **THEN** the tool displays a review checklist for credentials, private source, usernames, and absolute home paths before the fixture is committed

### Requirement: Deterministic production-path replay

The golden harness SHALL replay each case through the production VT screen adapter and agent-state detector using an injected clock and scheduler. It SHALL compare the ordered expected identity, state, signal, transition count, and any declared bottom-line snapshots without starting an agent process or using the network.

#### Scenario: Golden case is repeatable
- **WHEN** the same fixture case is run repeatedly
- **THEN** every run produces the same transition timeline without real-time sleeps

#### Scenario: Manifest version requires a fixture
- **WHEN** a bundled manifest lists an entry in `verified_against`
- **THEN** validation fails unless a fixture directory with matching agent and version metadata exists

#### Scenario: Manifest change runs positive and negative fixtures
- **WHEN** a bundled state pattern changes
- **THEN** the golden suite evaluates it against the intended state fixtures and the other-state negative fixtures for that agent

### Requirement: Fixture safety and maintenance checks

Committed fixtures SHALL pass repository checks for schema validity, size limits, known credential patterns, and accidental absolute home paths. Maintainers MUST review terminal content manually; automated sanitization SHALL NOT rewrite control sequences in a way that changes the rendered screen.

#### Scenario: Obvious credential is detected
- **WHEN** a candidate fixture contains a token matching a configured secret pattern
- **THEN** the fixture check fails before merge and identifies the file without printing the credential value

#### Scenario: New version preserves old regression data
- **WHEN** fixtures are added for a new agent build
- **THEN** prior verified-version fixtures remain in the suite unless a documented repository-size decision removes them

### Requirement: Live state snapshot diagnostics

The `webtabinal state snapshot <session-id>` command SHALL display the selected visible buffer's dimensions and bottom lines together with current agent identity, state, source signal, selected manifest and verified versions, and matched pattern IDs with line indexes. It SHALL support bounded `--lines`, `--buffer active|primary|alternate`, and `--json` output and SHALL be read-only.

#### Scenario: Human-readable snapshot succeeds
- **WHEN** the daemon is running and the user requests a valid live session
- **THEN** the command prints the requested bottom lines and match diagnostics without modifying the session

#### Scenario: JSON snapshot is machine readable
- **WHEN** the user adds `--json`
- **THEN** stdout contains the diagnostic response as valid JSON without explanatory text

#### Scenario: Unknown session fails clearly
- **WHEN** the user requests a session ID that does not exist
- **THEN** the command exits non-zero and reports that the session was not found

#### Scenario: Daemon is unavailable
- **WHEN** no authenticated WebTabinal daemon is listening at the configured loopback port
- **THEN** the command exits non-zero with an actionable connection error and does not start or mutate a daemon

### Requirement: Real-agent E2E remains opt-in

The project SHALL provide an explicit local `make e2e-state AGENT=<id>` workflow for maintainers with an installed agent and credentials. Normal CI SHALL run fixture replay and manifest validation without launching real agents, downloading binaries, changing user agent configuration, or consuming remote API credentials.

#### Scenario: Normal CI has no agent credential
- **WHEN** the repository test suite runs without agent API keys
- **THEN** all fixture and manifest tests run while real-agent E2E is not invoked

#### Scenario: Missing local agent is explicit
- **WHEN** a maintainer invokes `make e2e-state` for an unavailable binary
- **THEN** the target exits or skips with a clear prerequisite message and does not install the binary

### Requirement: Fixture maintenance is documented

README and contributor documentation SHALL describe verified agent versions, fixture capture and secret review, golden replay, manifest updates, local override troubleshooting, and state snapshot usage. Support language SHALL distinguish fixture-verified behavior from unverified versions.

#### Scenario: Maintainer updates a manifest
- **WHEN** a contributor follows the documented manifest-update workflow
- **THEN** the workflow requires fixture capture or reuse, `verified_against` reconciliation, negative-pattern checks, and golden test execution

