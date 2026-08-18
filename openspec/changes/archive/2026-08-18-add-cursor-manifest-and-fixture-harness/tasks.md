## 1. Fixture schema and golden harness

- [x] 1.1 Confirm the VT screen model and agent-state engine changes are applied, then define validated metadata and case schemas under `tests/fixtures/agents/<agent>/<version>/<scenario>`
- [x] 1.2 Implement fixture discovery and validation for required metadata, byte ranges, virtual time steps, expected identity/state/signal/count, geometry, and per-file size limits
- [x] 1.3 Implement deterministic replay through the production VT adapter and detector with an injected clock/scheduler and optional bottom-line assertions
- [x] 1.4 Validate that every bundled `verified_against` entry maps to matching fixture metadata and that changed patterns run against positive and other-state negative cases
- [x] 1.5 Add fixture safety checks for configured credential patterns and absolute home paths that identify files without printing secret values
- [x] 1.6 Migrate the Claude Code and Codex regression streams from `add-agent-state-engine` into the versioned schema and prove their timelines remain unchanged

## 2. Controlled recording tool

- [x] 2.1 Implement `scripts/record-agent-fixture.sh` argument parsing for agent, exact version, scenario, rows, columns, destination, overwrite opt-in, and command-after-separator
- [x] 2.2 Add BSD/util-linux `script(1)` platform detection, fixed TERM/UTF-8 geometry setup, temporary capture, metadata generation, and actionable unsupported-platform errors
- [x] 2.3 Validate capture success, metadata, and size before promotion and guarantee failed or interrupted recording leaves an existing destination unchanged
- [x] 2.4 Print pre/post capture warnings and the credential, private-source, username, and absolute-path manual review checklist without attempting control-sequence-breaking automatic redaction
- [x] 2.5 Add synthetic recorder tests for successful promotion, explicit overwrite, protected existing fixtures, oversized output, failed commands, and temporary-file cleanup

## 3. Cursor Agent fixtures and manifest

- [x] 3.1 Record controlled idle, working, unknown, and available approval/question scenarios from the installed Cursor Agent build, preserving its exact build string and OSC behavior in metadata
- [x] 3.2 Review and sanitize each candidate fixture for secrets and private paths without changing rendered screen shape, then add its expected virtual transition timeline
- [x] 3.3 Derive exact executable/command identity rules, activity/quiescence values, and conservative state pattern IDs solely from the reviewed fixtures
- [x] 3.4 Add the embedded `cursor-agent` manifest with `osc_authoritative=false` for the verified OSC-silent build and reconcile `verified_against` with fixture directories
- [x] 3.5 Run every Cursor state pattern across positive and other-state negative fixtures, proving unknown screens become idle and OSC 0/BEL never produce blocked
- [x] 3.6 If blocked evidence cannot be captured safely, omit speculative blocked patterns and record blocked detection as unverified in manifest notes and documentation

## 4. Read-only diagnostic endpoint

- [x] 4.1 Add a snapshot builder that combines bounded normalized screen lines, geometry, model/detector availability, current agent snapshot, selected manifest versions, and matched pattern IDs/line indexes
- [x] 4.2 Register `GET /api/sessions/{id}/state-snapshot` with strict `lines=1..200` and buffer validation plus distinct 400, 404, and structured 409 responses
- [x] 4.3 Reuse existing loopback Host/Origin and cookie/Bearer token middleware and ensure the handler exposes no input, resize, state mutation, or full-scrollback operation
- [x] 4.4 Add endpoint tests for cookie and Bearer success, missing/invalid auth, foreign Host/Origin, bounds/selectors, unknown session, unavailable model, response shape, and zero mutation
- [x] 4.5 Add logging tests proving bearer tokens, screen lines, and match substrings are absent from success and error logs

## 5. State snapshot CLI

- [x] 5.1 Extend CLI parsing and usage with `state snapshot <session-id>`, bounded `--lines`, allowed `--buffer`, and `--json` options while preserving existing commands
- [x] 5.2 Implement a timeout-bounded loopback HTTP client that loads the configured port/private token, sends Bearer authentication, and never auto-starts the daemon
- [x] 5.3 Implement stable human-readable output and JSON-only stdout, keeping errors and diagnostics on stderr with non-zero exit codes
- [x] 5.4 Add CLI tests for option validation, success formats, unavailable daemon, authentication failure, 404/409 responses, and proof that no session mutation request is sent

## 6. Local E2E, documentation, and verification

- [x] 6.1 Add an explicit `make e2e-state AGENT=<id>` target that checks prerequisites, never downloads or rewrites agent configuration, and remains outside normal CI
- [x] 6.2 Update README's Cursor section with fixture-verified versions/states, OSC-silent behavior, unknown-to-idle safety, local override, and snapshot troubleshooting
- [x] 6.3 Add contributor documentation for recording, manual secret review, sanitization constraints, fixture retention, golden replay, pattern negative checks, and `verified_against` updates
- [x] 6.4 Run fixture schema/safety/golden tests, agent detector tests, diagnostic server/CLI tests, the full Go suite under the race detector, and normal frontend/desktop regressions
- [x] 6.5 Manually run the state snapshot command and opt-in Cursor E2E against the verified build, recording supported states and any intentionally unverified blocked case
