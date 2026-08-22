import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const view = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/TerminalView.tsx'),
  'utf8',
);

test('TerminalView loads ImageAddon with the other xterm addons', () => {
  assert.match(view, /import \{ ImageAddon \} from '@xterm\/addon-image'/);
  assert.match(view, /term\.loadAddon\(fit\)/);
  assert.match(view, /term\.loadAddon\(search\)/);
  assert.match(view, /term\.loadAddon\(links\)/);
  assert.match(view, /term\.loadAddon\(new ImageAddon\(/);
});

test('ImageAddon loads after term.open and WebglAddon so it can bind the renderer', () => {
  const openAt = view.indexOf('term.open(');
  const webglAt = view.indexOf('new WebglAddon()');
  const imageAt = view.indexOf('new ImageAddon(');
  assert.ok(openAt >= 0, 'term.open must exist');
  assert.ok(webglAt >= 0, 'WebglAddon must still be loaded');
  assert.ok(imageAt >= 0, 'ImageAddon must be constructed');
  assert.ok(webglAt > openAt, 'WebglAddon must load after term.open');
  assert.ok(imageAt > webglAt, 'ImageAddon must load after WebglAddon');
});

test('ImageAddon starts with default protocol options', () => {
  const ctor = view.match(/new ImageAddon\(\{([\s\S]*?)\}\)/);
  assert.ok(ctor, 'ImageAddon must be constructed with an options object');
  const opts = ctor[1];
  assert.match(opts, /kittySupport:\s*true/);
  assert.match(opts, /enableSizeReports:\s*true/);
  assert.match(opts, /sixelSupport:\s*true/);
  assert.match(opts, /iipSupport:\s*true/);
});

test('xterm keeps allowProposedApi so the image addon can register APC handlers', () => {
  assert.match(view, /allowProposedApi:\s*true/);
});
