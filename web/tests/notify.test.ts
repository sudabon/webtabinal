import assert from 'node:assert/strict';
import test from 'node:test';

import { agentWaitContent, shouldRaiseDesktopNotification } from '../src/notify.ts';

test('wait notify is shown for a background tab', () => {
  assert.equal(
    shouldRaiseDesktopNotification({ enabled: true, always: false, active: false, focused: true }),
    true,
  );
});

test('wait notify is suppressed for the focused active tab', () => {
  assert.equal(
    shouldRaiseDesktopNotification({ enabled: true, always: false, active: true, focused: true }),
    false,
  );
});

test('wait notify ignores min duration', () => {
  assert.equal(
    shouldRaiseDesktopNotification({
      enabled: true,
      always: false,
      active: false,
      focused: false,
    }),
    true,
  );
});

test('completion still respects min duration when provided', () => {
  assert.equal(
    shouldRaiseDesktopNotification({
      enabled: true,
      always: false,
      active: false,
      focused: false,
      minDurationMs: 5000,
      runMs: 1000,
    }),
    false,
  );
});

test('always allows a focused active wait notification', () => {
  assert.equal(
    shouldRaiseDesktopNotification({ enabled: true, always: true, active: true, focused: true }),
    true,
  );
});

test('blocked wait events stay eligible without a duration threshold', () => {
  assert.equal(
    shouldRaiseDesktopNotification({
      enabled: true,
      always: false,
      active: false,
      focused: false,
    }),
    true,
  );
});

test('disabled notifications skip wait alerts', () => {
  assert.equal(
    shouldRaiseDesktopNotification({ enabled: false, always: true, active: false, focused: false }),
    false,
  );
});

test('agent wait content falls back to command then WebTabinal', () => {
  assert.deepEqual(agentWaitContent('', 'needs approval', 'codex'), {
    title: 'codex',
    body: 'needs approval',
  });
  assert.deepEqual(agentWaitContent('', 'needs approval'), {
    title: 'WebTabinal',
    body: 'needs approval',
  });
  assert.equal(agentWaitContent('  ', '  '), null);
  assert.deepEqual(agentWaitContent('Codex', 'Waiting for input'), {
    title: 'Codex',
    body: 'Waiting for input',
  });
});
