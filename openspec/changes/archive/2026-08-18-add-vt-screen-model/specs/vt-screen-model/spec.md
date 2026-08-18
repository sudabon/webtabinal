## ADDED Requirements

### Requirement: Session-scoped terminal screen reconstruction

The daemon SHALL maintain one headless terminal screen model for each live PTY session from the session's initial rows and columns. It SHALL feed every PTY output chunk to the model in byte order, maintain independent primary and alternate visible buffers, and track which buffer is active without requiring a connected browser.

#### Scenario: Primary screen is reconstructed without a client
- **WHEN** a session emits cursor movement, text, and erase sequences while no WebSocket client is attached
- **THEN** the daemon's primary screen model reflects the resulting visible cells

#### Scenario: Alternate screen is independent
- **WHEN** a session writes primary-screen content, enters DECSET 1049, writes alternate-screen content, and then leaves DECSET 1049
- **THEN** the active snapshot shows alternate content while DECSET 1049 is active and the original primary content after it is deactivated

#### Scenario: Scroll regions are applied
- **WHEN** output sets a DECSTBM scroll region and writes enough lines to scroll that region
- **THEN** the screen snapshot matches the expected fixed and scrolled rows from the fixture

### Requirement: Normalized bottom-line snapshots

The screen model SHALL provide immutable snapshots for `active`, `primary`, and `alternate` buffers. A request for K bottom lines SHALL return the final `min(K, rows)` visible rows in top-to-bottom order, including positional blank rows, with escape sequences removed, leading and interior spaces preserved, trailing blank cells removed, and wide-character continuation cells omitted.

#### Scenario: Active bottom lines are returned in display order
- **WHEN** a 40-row active screen is requested with K equal to 15
- **THEN** the snapshot contains visible rows 26 through 40 in that order

#### Scenario: Requested lines exceed screen height
- **WHEN** a 24-row buffer is requested with K equal to 200
- **THEN** the snapshot contains exactly the 24 visible rows and does not include scrollback

#### Scenario: A specific inactive buffer can be inspected
- **WHEN** the alternate screen is active and a primary-buffer snapshot is requested
- **THEN** the snapshot returns the preserved primary visible rows without changing the active buffer

#### Scenario: Japanese wide characters are normalized once
- **WHEN** a fixture writes Japanese wide characters followed by ASCII text and cursor-relative edits
- **THEN** each wide glyph appears once and the resulting line text matches the fixture's expected cell alignment

### Requirement: Screen geometry follows accepted PTY resize

The screen model SHALL start with the PTY's initial rows and columns and SHALL adopt each successfully accepted session resize. A snapshot after the resize operation completes SHALL report the new geometry and SHALL apply subsequent output using that geometry.

#### Scenario: Initial geometry is available
- **WHEN** a session is created with 120 columns and 40 rows
- **THEN** its first available screen snapshot reports 120 columns and 40 rows

#### Scenario: Resize updates the visible grid
- **WHEN** a live session successfully resizes from 80x24 to 160x50
- **THEN** a snapshot obtained after the resize completes reports 160 columns and 50 rows and reflects later output at the new width

#### Scenario: PTY resize failure does not claim a new geometry
- **WHEN** the underlying PTY rejects a resize request
- **THEN** the screen model and session metadata do not report that request as an accepted geometry

### Requirement: Concurrent access and lifecycle safety

PTY feeding, resize, and snapshot operations SHALL be safe under concurrent use. A session SHALL close its screen model with its PTY lifecycle, cancel pending model work, and SHALL NOT expose mutable emulator-owned cells to consumers.

#### Scenario: Feed resize and snapshot run concurrently
- **WHEN** tests repeatedly feed output, resize the model, and obtain snapshots from concurrent goroutines
- **THEN** the operations complete without a data race, deadlock, or partially mutated snapshot

#### Scenario: Session close releases the model
- **WHEN** a session is closed while snapshot consumers exist
- **THEN** model resources are released, future operations report unavailability, and the session close completes

### Requirement: Screen modeling cannot corrupt terminal delivery

Screen modeling SHALL NOT modify, omit, duplicate, or reorder bytes delivered to the existing ring buffer, OSC parser, and attached-client output path. Model construction or parsing failure SHALL be isolated to that session's screen model and SHALL NOT prevent PTY forwarding or session lifecycle handling.

#### Scenario: Forwarded bytes remain identical
- **WHEN** a deterministic 100 MiB PTY stream is processed with screen modeling enabled
- **THEN** every existing downstream sink receives the same bytes in the same order as the input stream

#### Scenario: Malformed terminal input is isolated
- **WHEN** malformed or unsupported escape sequences cause the model adapter to fail
- **THEN** the model reports itself unavailable, the failure is logged without screen contents, and ring buffering and client output continue

#### Scenario: Model creation failure does not reject the session
- **WHEN** a screen model cannot be created for a new PTY
- **THEN** the PTY session still starts and snapshot requests explicitly report model unavailability

### Requirement: VT conformance and resource measurements

The selected emulator adapter SHALL pass repository fixtures for primary and alternate screens, DECSTBM, cursor movement and erase, combining marks, Japanese wide characters, and resize. The project SHALL record per-session memory usage at 200x60 with both buffers and relative throughput for a 100 MiB stream; the memory review target SHALL be less than 1 MiB per session.

#### Scenario: Candidate emulator is accepted
- **WHEN** an emulator implementation is selected for integration
- **THEN** its conformance scorecard shows all mandatory fixtures passing and records the dependency and rationale

#### Scenario: Resource baseline is documented
- **WHEN** the integrated adapter benchmarks are run on the documented environment
- **THEN** the results include per-session memory, modeled versus unmodeled throughput, and whether the 1 MiB review target was met
