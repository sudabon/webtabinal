import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_KEY_BINDINGS,
  formatBinding,
  neighbourTabIndex,
  normalizeKeyEvent,
  resolveChordKey,
  validateBindings,
  type KeyBindings,
} from '../src/keymap.ts';

const enabled: KeyBindings = { ...DEFAULT_KEY_BINDINGS, enabled: true };

test('normalizeKeyEvent uses a fixed modifier order and lowercases the base key', () => {
  assert.equal(
    normalizeKeyEvent({ key: 'P', ctrlKey: true, shiftKey: true }),
    'ctrl+shift+p',
  );
  assert.equal(
    normalizeKeyEvent({ key: 'ArrowDown', altKey: true, metaKey: true, shiftKey: true, ctrlKey: true }),
    'ctrl+alt+shift+meta+arrowdown',
  );
  assert.equal(normalizeKeyEvent({ key: 'n' }), 'n');
  assert.equal(normalizeKeyEvent({ key: ' ' }), 'space');
});

test('normalizeKeyEvent returns null for modifier-only keys and IME composition', () => {
  assert.equal(normalizeKeyEvent({ key: 'Control', ctrlKey: true }), null);
  assert.equal(normalizeKeyEvent({ key: 'Meta', metaKey: true }), null);
  assert.equal(normalizeKeyEvent({ key: 'j', ctrlKey: true, isComposing: true }), null);
  assert.equal(normalizeKeyEvent({ key: 'j', ctrlKey: true, keyCode: 229 }), null);
});

test('formatBinding renders a readable chord', () => {
  assert.equal(formatBinding('ctrl+j'), 'Ctrl+J');
  assert.equal(formatBinding('n'), 'N');
  assert.equal(formatBinding('p'), 'P');
  assert.equal(formatBinding('meta+n'), 'Cmd+N');
  assert.equal(formatBinding('ctrl+shift+arrowdown'), 'Ctrl+Shift+Arrowdown');
});

test('validateBindings accepts the default chord', () => {
  assert.equal(validateBindings(DEFAULT_KEY_BINDINGS), null);
  assert.equal(validateBindings(enabled), null);
});

test('validateBindings rejects each invalid case', () => {
  assert.equal(validateBindings({ ...enabled, prefix: 'j' }), 'prefix_no_modifier');
  assert.equal(validateBindings({ ...enabled, next_tab: 'n', prev_tab: 'n' }), 'duplicate_action_key');
  assert.equal(validateBindings({ ...enabled, toggle_sidebar: 'n' }), 'duplicate_action_key');
  assert.equal(validateBindings({ ...enabled, toggle_sidebar: 'p' }), 'duplicate_action_key');
  assert.equal(validateBindings({ ...enabled, prefix: 'escape' }), 'escape');
  assert.equal(validateBindings({ ...enabled, next_tab: 'escape' }), 'escape');
  assert.equal(validateBindings({ ...enabled, toggle_sidebar: 'escape' }), 'escape');
  assert.equal(validateBindings({ ...enabled, prefix: 'Ctrl+J' }), 'unparsable');
  assert.equal(validateBindings({ ...enabled, prefix: '' }), 'unparsable');
  assert.equal(validateBindings({ ...enabled, toggle_sidebar: '' }), 'unparsable');
  assert.equal(validateBindings({ ...enabled, prefix: 'shift+ctrl+j' }), 'unparsable');
  assert.equal(validateBindings({ ...enabled, prefix: 'meta+n' }), 'reserved');
  assert.equal(validateBindings({ ...enabled, prefix: 'meta+1' }), 'reserved');
  assert.equal(validateBindings({ ...enabled, prefix: 'meta+c' }), 'reserved');
  assert.equal(validateBindings({ ...enabled, prefix: 'meta+v' }), 'reserved');
});

test('resolveChordKey implements the prefix state machine', () => {
  assert.deepEqual(resolveChordKey(false, 'ctrl+j', enabled), { pending: true, action: 'arm' });
  assert.deepEqual(resolveChordKey(true, 'n', enabled), { pending: false, action: 'next' });
  assert.deepEqual(resolveChordKey(true, 'p', enabled), { pending: false, action: 'prev' });
  assert.deepEqual(resolveChordKey(true, 'j', enabled), { pending: false, action: 'toggle_sidebar' });
  assert.deepEqual(resolveChordKey(true, 'x', enabled), { pending: false, action: 'cancel' });
  assert.deepEqual(resolveChordKey(true, 'escape', enabled), { pending: false, action: 'cancel' });
  assert.deepEqual(resolveChordKey(true, 'ctrl+j', enabled), { pending: true, action: 'arm' });
  assert.deepEqual(resolveChordKey(false, 'n', enabled), { pending: false, action: 'none' });
  assert.deepEqual(resolveChordKey(true, null, enabled), { pending: true, action: 'none' });
  assert.deepEqual(resolveChordKey(false, 'ctrl+j', DEFAULT_KEY_BINDINGS), { pending: false, action: 'none' });
  assert.deepEqual(resolveChordKey(true, 'j', DEFAULT_KEY_BINDINGS), { pending: false, action: 'none' });
});

test('neighbourTabIndex wraps and no-ops for a single or missing session', () => {
  assert.equal(neighbourTabIndex(3, 2, 'next'), 0);
  assert.equal(neighbourTabIndex(3, 0, 'prev'), 2);
  assert.equal(neighbourTabIndex(3, 1, 'next'), 2);
  assert.equal(neighbourTabIndex(1, 0, 'next'), 0);
  assert.equal(neighbourTabIndex(1, 0, 'prev'), 0);
  assert.equal(neighbourTabIndex(0, 0, 'next'), -1);
  assert.equal(neighbourTabIndex(3, -1, 'next'), -1);
});
