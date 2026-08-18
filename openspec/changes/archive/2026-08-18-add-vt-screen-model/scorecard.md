# VT emulator scorecard

Evaluated against `internal/vtscreen` conformance fixtures on darwin/arm64, Go 1.26, 2026-08-18.

| Criterion | `charmbracelet/x/vt` v0.0.0-20260816001655-68d539dca504 | `hinshun/vt10x` v0.0.0-20220301184237-5011da428d02 |
|---|---|---|
| primary-screen-edits | pass | pass |
| DECSET/DECRST 1049 | pass | pass |
| DECSTBM | pass | pass |
| cursor erase/movement | pass | pass |
| combining marks | pass (stored as width-0 cell; adapter concatenates onto the base glyph) | pass (own width-1 cell) |
| Japanese wide glyphs | pass (`Cell.Width == 2` plus empty continuation) | **fail** (`日本語   X` — cursor columns ignore wcwidth) |
| resize | pass | pass |
| Alt-buffer access | `IsAltScreen()` for the active screen; primary/alt structs are unexported | `Mode() & ModeAltScreen`; `altLines` unexported |
| Inactive buffer | not public; adapter caches the last captured active grid per buffer | same adapter-side cache required |
| CJK / wide cells | native width tracking | one column per rune |
| Resize semantics | both screens resized; clip/preserve per library | both screens resized |
| Maintenance | active Charmbracelet module, 2026 commits | last release 2022 |
| Direct dependencies | `ultraviolet`, `x/ansi`, `x/exp/ordered` plus transitive color/width packages | none |
| Module cost | larger | smaller |

## Decision

Adopt **`github.com/charmbracelet/x/vt`**.

It is the only evaluated candidate that passes every mandatory fixture. `hinshun/vt10x` is the smaller module, but it cannot reconstruct Japanese wide-glyph alignment, which is a stated requirement for later detector snapshots. Inactive-buffer inspection is missing from both libraries and is provided by the adapter cache rather than a library fork.

## Resource baseline

Measured on darwin/arm64, Apple M2, Go 1.26, 2026-08-18.

| Measurement | Result |
|---|---|
| 200x60 primary + alternate heap delta | ~7.2 MiB |
| 1 MiB review target | **not met** |
| 100 MiB stream identity | ring buffer and `onOutput` bytes match input with modeling enabled |
| 100 MiB unmodeled throughput | ~837 MB/s |
| 100 MiB modeled throughput | ~1.65 MB/s (~500x slower on a newline-heavy synthetic stream) |

The selected emulator allocates a 4 MiB ANSI parser data buffer inside `NewEmulator`, which alone exceeds the 1 MiB review target. Adapter-side line caches are small; most resident cost is the library parser plus two styled cell grids. The modeled-stream slowdown is expected for synchronous VT parsing of a 100 MiB glyph/newline stream in the PTY read loop and is recorded as the merge-gate baseline rather than an API SLO.
