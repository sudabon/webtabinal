## ADDED Requirements

### Requirement: Bundled Cursor Agent manifest

The daemon SHALL bundle a schema-versioned `cursor-agent` manifest that identifies Cursor Agent by executable and command patterns, declares screen and activity authority, records exact tested builds in `verified_against`, and does not require OSC 9, OSC 99, or OSC 777 for those tested builds.

#### Scenario: Verified Cursor executable is identified
- **WHEN** a foreground executable or shell command matches the bundled Cursor Agent manifest
- **THEN** the detector selects the `cursor-agent` identity

#### Scenario: Tested OSC-silent build uses screen detection
- **WHEN** a build listed in `verified_against` emits no notification OSC while its fixture is replayed
- **THEN** the expected agent states are derived from screen and activity signals

#### Scenario: Verification claim names an exact build
- **WHEN** the bundled Cursor Agent manifest is inspected
- **THEN** each `verified_against` value identifies an exact build that has a matching repository fixture

### Requirement: Cursor state patterns are fixture-derived and conservative

Every bundled Cursor Agent idle, working, or blocked pattern SHALL be supported by a positive fixture from a verified build and SHALL be checked against the other-state fixtures as negative examples. Blocked authority MUST be limited to high-confidence screen patterns and MUST NOT be inferred from BEL, OSC 0 title changes, process existence alone, or an unmatched screen.

#### Scenario: Verified idle fixture becomes idle
- **WHEN** a verified Cursor Agent idle fixture is replayed and output reaches quiescence
- **THEN** the detector reports `idle`

#### Scenario: Verified working fixture becomes working
- **WHEN** a verified Cursor Agent working fixture is replayed with its recorded activity timeline
- **THEN** the detector reports `working`

#### Scenario: Verified approval fixture becomes blocked
- **WHEN** a verified Cursor Agent approval or question fixture contains a high-confidence blocked pattern
- **THEN** the detector reports `blocked` without waiting for quiescence

#### Scenario: Pattern does not match another state fixture
- **WHEN** each Cursor blocked pattern is evaluated against all verified idle and working fixtures
- **THEN** none of those negative fixtures match the blocked pattern

#### Scenario: Unknown Cursor screen fails safe
- **WHEN** Cursor Agent is identified but the quiet screen matches no manifest state pattern
- **THEN** the detector reports `idle`, not `blocked`

#### Scenario: OSC 0 and BEL do not block
- **WHEN** Cursor Agent emits an OSC 0 title sequence terminated by BEL without a blocked screen pattern
- **THEN** that sequence does not cause a blocked state or agent-attention notification

### Requirement: Cursor support claims track fixture coverage

The project SHALL document the last verified Cursor Agent build and the states covered by its committed fixtures. A state without fixture evidence SHALL be described as unverified rather than inferred or guaranteed.

#### Scenario: Blocked fixture is unavailable
- **WHEN** no controlled blocked-state fixture can be captured for a Cursor build
- **THEN** that build is not documented as verified for blocked detection and no speculative blocked pattern is bundled

#### Scenario: New Cursor build is evaluated
- **WHEN** maintainers update the documented verified Cursor version
- **THEN** they add that build's metadata and state fixtures and run the manifest golden suite before changing the support claim
