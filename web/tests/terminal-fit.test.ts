import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function cssBlock(css: string, selector: string): string {
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
  );
  const match = css.match(re);
  assert.ok(match, `missing CSS block for ${selector}`);
  return match[1];
}

test('FitAddon measures a padding-free terminal-fit node', () => {
  const view = readFileSync(join(root, 'src/components/TerminalView.tsx'), 'utf8');
  assert.match(
    view,
    /className="terminal-fit"[^>]*ref=\{hostRef\}|ref=\{hostRef\}[^>]*className="terminal-fit"/,
  );

  const css = readFileSync(join(root, 'src/index.css'), 'utf8');
  const fit = cssBlock(css, '.terminal-fit');
  assert.equal(/\bpadding\s*:/.test(fit), false, '.terminal-fit must not set padding');
  assert.match(fit, /height:\s*100%/);

  const xterm = cssBlock(css, '.terminal-host .xterm');
  assert.match(xterm, /inset:\s*0/);
});
