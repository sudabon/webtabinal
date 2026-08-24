import assert from 'node:assert/strict';
import test from 'node:test';

import {
  attachableImages,
  blobFromBase64,
  dragCarriesFiles,
  escapeTerminalPath,
  isAttachableImageType,
  readClipboardImage,
  terminalTextForPaths,
} from '../src/image-attach.ts';

test('only the image types every agent reads are attachable', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
    assert.equal(isAttachableImageType(type), true, type);
  }
  // SVG is a script container and no agent needs it; the rest are not images.
  for (const type of ['image/svg+xml', 'text/plain', 'application/pdf', '', null, undefined]) {
    assert.equal(isAttachableImageType(type), false, String(type));
  }
});

test('image type matching ignores parameters and case', () => {
  assert.equal(isAttachableImageType('image/PNG'), true);
  assert.equal(isAttachableImageType('image/jpeg; charset=binary'), true);
});

test('attachableImages keeps only images and tolerates an absent list', () => {
  const files = [
    { type: 'image/png', name: 'a.png' },
    { type: 'text/plain', name: 'notes.txt' },
    { type: 'image/webp', name: 'b.webp' },
  ];
  assert.deepEqual(
    attachableImages(files).map((f) => f.name),
    ['a.png', 'b.webp'],
  );
  assert.deepEqual(attachableImages(null), []);
  assert.deepEqual(attachableImages(undefined), []);
  assert.deepEqual(attachableImages([]), []);
});

test('a drag is claimed only when it carries files', () => {
  assert.equal(dragCarriesFiles(['Files']), true);
  assert.equal(dragCarriesFiles(['text/plain', 'Files']), true);
  // Tab reordering drags text, and must keep falling through to the sidebar.
  assert.equal(dragCarriesFiles(['text/plain']), false);
  assert.equal(dragCarriesFiles([]), false);
  assert.equal(dragCarriesFiles(null), false);
});

test('the support directory space is escaped the way a terminal escapes a dropped path', () => {
  assert.equal(
    escapeTerminalPath('/Users/me/Library/Application Support/WebTabinal/images/img-1.png'),
    '/Users/me/Library/Application\\ Support/WebTabinal/images/img-1.png',
  );
});

test('shell metacharacters anywhere in the path are escaped', () => {
  assert.equal(escapeTerminalPath("/tmp/a b/c'd/e$f/g;h.png"), "/tmp/a\\ b/c\\'d/e\\$f/g\\;h.png");
  assert.equal(escapeTerminalPath('/tmp/back\\slash.png'), '/tmp/back\\\\slash.png');
  // A path needing nothing is left byte-for-byte alone.
  assert.equal(escapeTerminalPath('/tmp/plain/img-1.png'), '/tmp/plain/img-1.png');
});

test('terminal text separates paths and leaves a trailing space for the prompt', () => {
  assert.equal(terminalTextForPaths(['/tmp/a.png']), '/tmp/a.png ');
  assert.equal(terminalTextForPaths(['/tmp/a.png', '/tmp/b.png']), '/tmp/a.png /tmp/b.png ');
});

test('terminal text for no usable path is empty, so nothing is typed', () => {
  assert.equal(terminalTextForPaths([]), '');
  assert.equal(terminalTextForPaths(['', '   ']), '');
});

test('readClipboardImage returns the first attachable image on the clipboard', async () => {
  const png = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
  const clipboard = {
    read: async () => [
      { types: ['text/plain'], getType: async () => new Blob(['x']) },
      { types: ['text/html', 'image/png'], getType: async (t: string) => (t === 'image/png' ? png : new Blob()) },
    ],
  } as unknown as Clipboard;
  assert.equal(await readClipboardImage(clipboard), png);
});

test('readClipboardImage yields null for text-only, a missing API, or a refused read', async () => {
  const textOnly = {
    read: async () => [{ types: ['text/plain'], getType: async () => new Blob(['x']) }],
  } as unknown as Clipboard;
  assert.equal(await readClipboardImage(textOnly), null);

  assert.equal(await readClipboardImage(undefined), null);
  assert.equal(await readClipboardImage({} as Clipboard), null);

  const refused = {
    read: async () => {
      throw new Error('NotAllowedError');
    },
  } as unknown as Clipboard;
  assert.equal(await readClipboardImage(refused), null);
});

test('blobFromBase64 rebuilds the bytes the desktop shell read off NSPasteboard', async () => {
  const blob = blobFromBase64('AAECAw==', 'image/png');
  assert.equal(blob.type, 'image/png');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), new Uint8Array([0, 1, 2, 3]));
});
