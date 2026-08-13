import assert from 'node:assert/strict';
import test from 'node:test';

import { clampUnicode, isStandalone, openExternalLink, sessionBootstrapAction, shouldUseWebglRenderer, unicodeLength } from '../src/util.ts';

test('external links open in a new tab without an opener', () => {
  const calls: unknown[][] = [];
  Object.assign(globalThis, {
    window: {
      open: (...args: unknown[]) => {
        calls.push(args);
        return null;
      },
    },
  });

  openExternalLink('https://example.com/');

  assert.deepEqual(calls, [['https://example.com/', '_blank', 'noopener']]);
});

test('isStandalone is true for display-mode standalone', () => {
  Object.assign(globalThis, {
    window: {
      matchMedia: (query: string) => ({
        matches: query === '(display-mode: standalone)',
      }),
    },
  });
  assert.equal(isStandalone(), true);
});

test('isStandalone is true when the native desktop flag is set', () => {
  Object.assign(globalThis, {
    window: {
      matchMedia: () => ({ matches: false }),
      __WEBTABINAL_DESKTOP__: true,
    },
  });
  assert.equal(isStandalone(), true);
});

test('isStandalone is false in a normal browser tab', () => {
  Object.assign(globalThis, {
    window: {
      matchMedia: () => ({ matches: false }),
    },
  });
  assert.equal(isStandalone(), false);
});

const chromeUA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const safariUA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const wkWebViewUA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';

test('shouldUseWebglRenderer is true for Chrome', () => {
  assert.equal(shouldUseWebglRenderer(chromeUA, false), true);
});

test('shouldUseWebglRenderer is false for Safari', () => {
  assert.equal(shouldUseWebglRenderer(safariUA, false), false);
});

test('shouldUseWebglRenderer is false for WKWebView', () => {
  assert.equal(shouldUseWebglRenderer(wkWebViewUA, false), false);
});

test('shouldUseWebglRenderer is false in the native desktop shell', () => {
  assert.equal(shouldUseWebglRenderer(chromeUA, true), false);
});

test('sessionBootstrapAction creates a session when none exist', () => {
  assert.deepEqual(sessionBootstrapAction([], null), { type: 'create' });
});

test('sessionBootstrapAction restarts an exited active session', () => {
  assert.deepEqual(
    sessionBootstrapAction(
      [{ id: 'a', state: 'exited' }, { id: 'b', state: 'idle' }],
      'a',
    ),
    { type: 'restart', id: 'a' },
  );
});

test('sessionBootstrapAction restarts the first session when it is exited and none is active', () => {
  assert.deepEqual(
    sessionBootstrapAction([{ id: 'dead', state: 'exited' }], null),
    { type: 'restart', id: 'dead' },
  );
});

test('sessionBootstrapAction leaves a live session alone', () => {
  assert.deepEqual(
    sessionBootstrapAction([{ id: 'live', state: 'idle' }], 'live'),
    { type: 'none' },
  );
});

test('unicodeLength counts code points not UTF-16 units', () => {
  assert.equal(unicodeLength('CI'), 2);
  assert.equal(unicodeLength('あいう'), 3);
  assert.equal(unicodeLength('🙂🙂'), 2);
});

test('clampUnicode keeps at most 30 code points', () => {
  const exact = 'あ'.repeat(30);
  const over = exact + 'い';
  assert.equal(clampUnicode(exact), exact);
  assert.equal(clampUnicode(over), exact);
  assert.equal(unicodeLength(clampUnicode(over)), 30);
});
