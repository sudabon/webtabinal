import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyClipboardShortcut,
  clipboardShortcutAction,
  fieldSelectionText,
  installTerminalClipboardFacade,
  insertTextIntoField,
  isTextFieldElement,
  requestClipboardPaste,
} from '../src/clipboard.ts';

test('Cmd+C copies and Cmd+V pastes unless a text field is focused', () => {
  assert.equal(clipboardShortcutAction({ type: 'keydown', key: 'c', metaKey: true }), 'copy');
  assert.equal(clipboardShortcutAction({ type: 'keydown', key: 'v', metaKey: true }), 'paste');
  assert.equal(
    clipboardShortcutAction({ type: 'keydown', key: 'c', metaKey: true }, { textFieldFocused: true }),
    'ignore',
  );
  assert.equal(
    clipboardShortcutAction({ type: 'keydown', key: 'v', metaKey: true }, { textFieldFocused: true }),
    'ignore',
  );
});

test('clipboard shortcuts ignore Ctrl+C, keyup, and IME composition', () => {
  assert.equal(clipboardShortcutAction({ type: 'keydown', key: 'c', ctrlKey: true }), 'ignore');
  assert.equal(clipboardShortcutAction({ type: 'keyup', key: 'c', metaKey: true }), 'ignore');
  assert.equal(clipboardShortcutAction({ type: 'keydown', key: 'c', metaKey: true, isComposing: true }), 'ignore');
  assert.equal(clipboardShortcutAction({ type: 'keydown', key: 'c', metaKey: true, keyCode: 229 }), 'ignore');
});

test('copy with a selection writes text; empty selection is a handled no-op', () => {
  const written: string[] = [];
  const pasted: string[] = [];
  const writeText = (text: string) => written.push(text);
  const requestPaste = () => pasted.push('paste');

  assert.equal(
    applyClipboardShortcut('copy', { selection: 'ls -la', writeText, requestPaste }),
    'handled',
  );
  assert.deepEqual(written, ['ls -la']);
  assert.deepEqual(pasted, []);

  written.length = 0;
  assert.equal(
    applyClipboardShortcut('copy', { selection: '', writeText, requestPaste }),
    'handled',
  );
  assert.deepEqual(written, []);
  assert.deepEqual(pasted, []);
});

test('paste requests clipboard text', () => {
  const written: string[] = [];
  const pasted: string[] = [];
  assert.equal(
    applyClipboardShortcut('paste', {
      selection: 'ignored',
      writeText: (text) => written.push(text),
      requestPaste: () => pasted.push('paste'),
    }),
    'handled',
  );
  assert.deepEqual(written, []);
  assert.deepEqual(pasted, ['paste']);
});

test('text field detection uses input and textarea', () => {
  assert.equal(isTextFieldElement({ tagName: 'INPUT' }), true);
  assert.equal(isTextFieldElement({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTextFieldElement({ tagName: 'TEXTAREA', className: 'xterm-helper-textarea' }), false);
  assert.equal(isTextFieldElement({ tagName: 'DIV' }), false);
  assert.equal(isTextFieldElement({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(
    fieldSelectionText({ tagName: 'INPUT', value: 'hello', selectionStart: 1, selectionEnd: 4 }),
    'ell',
  );
});

test('facade copies terminal selection unless a field is focused', () => {
  const pasted: string[] = [];
  const host = {
    getSelection: () => 'term-sel',
    paste: (text: string) => pasted.push(text),
  };
  const input = { tagName: 'INPUT', value: 'hello', selectionStart: 0, selectionEnd: 5 };
  const target = {
    document: { activeElement: null as object | null },
    __webtabinalClipboard: undefined as undefined | {
      focusKind: () => string;
      copyText: () => string;
      paste: (text: string) => void;
    },
  };
  const uninstall = installTerminalClipboardFacade(host, target);
  const facade = target.__webtabinalClipboard;
  assert.ok(facade);

  assert.equal(facade.focusKind(), 'terminal');
  assert.equal(facade.copyText(), 'term-sel');

  target.document.activeElement = { tagName: 'TEXTAREA', className: 'xterm-helper-textarea' };
  assert.equal(facade.focusKind(), 'terminal');
  assert.equal(facade.copyText(), 'term-sel');

  target.document.activeElement = input;
  assert.equal(facade.focusKind(), 'textfield');
  assert.equal(facade.copyText(), 'hello');

  facade.paste('from-board');
  assert.deepEqual(pasted, ['from-board']);
  uninstall();
});

test('insertTextIntoField replaces the current selection', () => {
  const input = { tagName: 'INPUT', value: 'hello', selectionStart: 1, selectionEnd: 4 };
  assert.equal(insertTextIntoField(input, 'XX'), true);
  assert.equal(input.value, 'hXXo');
});

test('desktop paste uses the native read path', () => {
  const calls: string[] = [];
  Object.assign(globalThis, { window: { __WEBTABINAL_DESKTOP__: true } });
  requestClipboardPaste(() => calls.push('desktop'), () => calls.push('web'));
  assert.deepEqual(calls, ['desktop']);

  Object.assign(globalThis, { window: {} });
  requestClipboardPaste(() => calls.push('desktop'), () => calls.push('web'));
  assert.deepEqual(calls, ['desktop', 'web']);
});
