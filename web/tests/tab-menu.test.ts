import assert from 'node:assert/strict';
import test from 'node:test';

import { nextEnabledIndex, placeMenu } from '../src/tab-menu.ts';

const viewport = { viewportWidth: 800, viewportHeight: 600 };

test('menu opens to the bottom-right of the pointer when it fits', () => {
  assert.deepEqual(placeMenu({ x: 100, y: 120, width: 160, height: 140, ...viewport }), { left: 100, top: 120 });
});

test('menu flips left when it would overflow the right edge', () => {
  assert.deepEqual(placeMenu({ x: 750, y: 120, width: 160, height: 140, ...viewport }), { left: 590, top: 120 });
});

test('menu flips up when it would overflow the bottom edge', () => {
  assert.deepEqual(placeMenu({ x: 100, y: 550, width: 160, height: 140, ...viewport }), { left: 100, top: 410 });
});

test('menu flips both ways near the bottom-right corner', () => {
  assert.deepEqual(placeMenu({ x: 790, y: 590, width: 160, height: 140, ...viewport }), { left: 630, top: 450 });
});

test('menu is pinned inside a viewport too small for either side', () => {
  assert.deepEqual(
    placeMenu({ x: 100, y: 100, width: 160, height: 140, viewportWidth: 200, viewportHeight: 180 }),
    { left: 36, top: 36 },
  );
});

test('arrow navigation skips disabled items and wraps', () => {
  const disabled = [false, true, false, false];
  assert.equal(nextEnabledIndex(disabled, -1, 1), 0);
  assert.equal(nextEnabledIndex(disabled, 0, 1), 2);
  assert.equal(nextEnabledIndex(disabled, 3, 1), 0);
  assert.equal(nextEnabledIndex(disabled, 2, -1), 0);
  assert.equal(nextEnabledIndex(disabled, 0, -1), 3);
  assert.equal(nextEnabledIndex(disabled, 4, -1), 3);
});

test('navigation reports no target when every item is disabled', () => {
  assert.equal(nextEnabledIndex([true, true], 0, 1), -1);
});
