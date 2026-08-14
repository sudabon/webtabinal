import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { shouldForwardTerminalInput } from '../src/terminal-input.ts';

test('live attached input is forwarded', () => {
  assert.equal(shouldForwardTerminalInput('sid-a', false), true);
});

test('replay does not forward xterm replies as PTY input', () => {
  assert.equal(shouldForwardTerminalInput('sid-a', true), false);
});

test('detached terminal does not forward input', () => {
  assert.equal(shouldForwardTerminalInput(null, false), false);
});

test('TerminalView recreates xterm when the session changes', () => {
  const view = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../src/components/TerminalView.tsx'),
    'utf8',
  );
  assert.match(view, /shouldForwardTerminalInput\(sid, replayingRef\.current\)/);
  assert.match(view, /replayingRef\.current = true/);
  assert.match(view, /replayingRef\.current = false/);
  assert.match(
    view,
    /}, \[sessionId\]\);/,
    'xterm must be recreated on session switch so queued OSC replies cannot follow the new sid',
  );
});
