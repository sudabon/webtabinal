import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { xtermViewOptions } from '../src/theme.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('xterm boosts cell contrast to WCAG AA so dark-on-black TUI text stays readable', () => {
  const light = xtermViewOptions('light');
  assert.equal(light.minimumContrastRatio, 4.5);
  assert.equal(light.theme.background, '#ffffff');
  assert.equal(light.theme.foreground, '#333333');

  const dark = xtermViewOptions('dark');
  assert.equal(dark.minimumContrastRatio, 4.5);
  assert.equal(dark.theme.background, '#1e1e1e');
});

test('TerminalView applies xtermViewOptions on create and theme change', () => {
  const view = readFileSync(join(root, 'src/components/TerminalView.tsx'), 'utf8');
  assert.match(view, /\.\.\.xtermViewOptions\(theme\)/);
  assert.match(view, /term\.options\.minimumContrastRatio = opts\.minimumContrastRatio/);
});
