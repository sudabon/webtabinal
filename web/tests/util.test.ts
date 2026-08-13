import assert from 'node:assert/strict';
import test from 'node:test';

import { openExternalLink } from '../src/util.ts';

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
