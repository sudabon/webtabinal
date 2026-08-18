#!/usr/bin/env bash
# Opt-in local E2E for agent state detection. Never downloads binaries or
# rewrites agent configuration. Not invoked by normal CI.
set -euo pipefail

AGENT="${1:-${AGENT:-}}"
if [[ -z "$AGENT" ]]; then
  printf 'usage: make e2e-state AGENT=<claude|codex|cursor-agent>\n' >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN=""
case "$AGENT" in
  claude) BIN="claude" ;;
  codex) BIN="codex" ;;
  cursor-agent|cursor)
    AGENT="cursor-agent"
    if command -v cursor-agent >/dev/null 2>&1; then
      BIN="cursor-agent"
    elif command -v agent >/dev/null 2>&1; then
      BIN="agent"
    fi
    ;;
  *)
    printf 'unknown AGENT=%s (expected claude, codex, or cursor-agent)\n' "$AGENT" >&2
    exit 2
    ;;
esac

if [[ -z "$BIN" ]] || ! command -v "$BIN" >/dev/null 2>&1; then
  printf 'e2e-state: %s binary is not installed or not on PATH.\n' "$AGENT" >&2
  printf 'Install the agent yourself; this target does not download binaries or rewrite config.\n' >&2
  exit 1
fi

printf 'e2e-state: using %s (%s)\n' "$AGENT" "$(command -v "$BIN")"
if command -v "$BIN" >/dev/null 2>&1; then
  "$BIN" --version 2>/dev/null || "$BIN" version 2>/dev/null || true
fi

cat <<EOF
Next steps (interactive, local only):
  1. Ensure webtabinal daemon is already running (this target will not start it).
  2. Record a controlled fixture:
       $ROOT/scripts/record-agent-fixture.sh --agent $AGENT --version <exact> --scenario idle -- $BIN
  3. Review stream.raw for secrets, then fill case.json.
  4. Diagnose a live session:
       $ROOT/bin/webtabinal state snapshot <session-id>
Verified Cursor Agent states for 2026.08.11-e8db854: idle, working, unknown-to-idle.
Blocked/approval detection is unverified for that build.
EOF
