import assert from 'node:assert/strict';
import test from 'node:test';

import { isStandalone, openExternalLink } from '../src/util.ts';

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
