import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SHIFT_ENTER_SEQUENCE,
  shiftEnterSequence,
  shouldForwardTerminalInput,
  type TerminalKeyEvent,
} from '../src/terminal-input.ts';

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

function enterEvent(overrides: Partial<TerminalKeyEvent> = {}): TerminalKeyEvent {
  return {
    type: 'keydown',
    key: 'Enter',
    shiftKey: true,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    isComposing: false,
    ...overrides,
  };
}

test('Shift+Enter sends ESC+CR, the sequence agent CLIs read as insert-newline', () => {
  assert.equal(SHIFT_ENTER_SEQUENCE, '\x1b\r');
  assert.equal(shiftEnterSequence(enterEvent(), true), SHIFT_ENTER_SEQUENCE);
});

test('Shift+Enter falls back to the xterm default when the option is off', () => {
  assert.equal(shiftEnterSequence(enterEvent(), false), null);
});

test('plain Enter still submits', () => {
  assert.equal(shiftEnterSequence(enterEvent({ shiftKey: false }), true), null);
});

test('Shift+Enter is rewritten on keydown only, never on keypress or keyup', () => {
  assert.equal(shiftEnterSequence(enterEvent({ type: 'keypress' }), true), null);
  assert.equal(shiftEnterSequence(enterEvent({ type: 'keyup' }), true), null);
});

test('IME conversion Enter is left to the composition, not rewritten', () => {
  assert.equal(shiftEnterSequence(enterEvent({ isComposing: true }), true), null);
  assert.equal(shiftEnterSequence(enterEvent({ isComposing: undefined, keyCode: 229 }), true), null);
});

test('other modifiers keep their existing meaning', () => {
  assert.equal(shiftEnterSequence(enterEvent({ ctrlKey: true }), true), null);
  assert.equal(shiftEnterSequence(enterEvent({ altKey: true }), true), null);
  assert.equal(shiftEnterSequence(enterEvent({ metaKey: true }), true), null);
});

test('non-Enter keys are untouched', () => {
  assert.equal(shiftEnterSequence(enterEvent({ key: 'a' }), true), null);
});

test('TerminalView forwards the Shift+Enter sequence through the live session socket', () => {
  const view = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../src/components/TerminalView.tsx'),
    'utf8',
  );
  assert.match(view, /shiftEnterSequence\(ev, shiftEnterNewlineRef\.current\)/);
  assert.match(
    view,
    /shiftEnterNewlineRef\.current = /,
    'the option must be read through a ref because the xterm effect only re-runs on sessionId',
  );
});
