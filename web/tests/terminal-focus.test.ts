import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { shouldApplyTerminalFocus } from '../src/terminal-focus.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('terminal focus is applied only when no modal is open', () => {
  assert.equal(shouldApplyTerminalFocus({ settingsOpen: false, memoOpen: false }), true);
  assert.equal(shouldApplyTerminalFocus({ settingsOpen: true, memoOpen: false }), false);
  assert.equal(shouldApplyTerminalFocus({ settingsOpen: false, memoOpen: true }), false);
  assert.equal(shouldApplyTerminalFocus({ settingsOpen: true, memoOpen: true }), false);
});

test('App requests terminal focus on tab select and new tab, not memo edit', () => {
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');

  const select = app.match(/const select = \(id: string\) => \{[\s\S]*?\n  \};/);
  assert.ok(select, 'select() must exist');
  assert.match(select[0], /setFocusSeq/, 'tab select (including the active tab) must request focus');
  assert.match(app, /select\(s\.id\)/, 'Cmd+1..9 must go through select()');

  const createTab = app.match(/const createTab = async \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(createTab, 'createTab() must exist');
  assert.match(createTab[0], /setFocusSeq/, 'new tab must request focus');

  const editMemo = app.match(/onEditMemo=\{\(id\) => \{[\s\S]*?\}\}/);
  assert.ok(editMemo, 'onEditMemo must exist');
  assert.doesNotMatch(editMemo[0], /setFocusSeq/, 'memo edit must not request terminal focus');

  assert.match(app, /<TerminalView[\s\S]*focusSeq=\{focusSeq\}/);
  assert.match(app, /<TerminalView[\s\S]*settingsOpen=\{settingsOpen\}/);
  assert.match(app, /<TerminalView[\s\S]*memoOpen=\{memoSessionId != null\}/);
});

test('TerminalView focuses xterm after session recreate when allowed', () => {
  const view = readFileSync(join(root, 'src/components/TerminalView.tsx'), 'utf8');
  assert.match(view, /shouldApplyTerminalFocus/);
  const recreate = view.indexOf('}, [sessionId]);');
  const focus = view.search(/term(?:Ref\.current)\?\.focus\(\)/);
  assert.ok(recreate >= 0, 'xterm recreate effect must remain keyed on sessionId');
  assert.ok(focus > recreate, 'term.focus() must run after the sessionId recreate effect');
});
