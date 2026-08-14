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

test('xterm palette hex stays in sync with daemon OSC palette', () => {
  const light = xtermViewOptions('light');
  const dark = xtermViewOptions('dark');
  const go = readFileSync(join(root, '..', 'internal/osc/color.go'), 'utf8');
  assert.match(go, new RegExp(`Foreground: "${light.theme.foreground}".*Background: "${light.theme.background}"`));
  assert.match(go, new RegExp(`Foreground: "${dark.theme.foreground}".*Background: "${dark.theme.background}"`));
});

test('TerminalView applies xtermViewOptions on create and theme change', () => {
  const view = readFileSync(join(root, 'src/components/TerminalView.tsx'), 'utf8');
  assert.match(view, /\.\.\.xtermViewOptions\(theme\)/);
  assert.match(view, /term\.options\.minimumContrastRatio = opts\.minimumContrastRatio/);
});
