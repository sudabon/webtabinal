import assert from 'node:assert/strict';
import test from 'node:test';

import { TerminalSocket } from '../src/ws.ts';

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

Object.assign(globalThis, {
  location: { protocol: 'http:', host: '127.0.0.1:8642' },
  WebSocket: FakeWebSocket,
  window: globalThis,
});

test('input sends UTF-8 bytes for non-Latin-1 text', () => {
  FakeWebSocket.instances = [];
  const socket = new TerminalSocket({ onMessage: () => {} });

  socket.input('sid', 'あé');

  const sent = JSON.parse(FakeWebSocket.instances[0].sent[0]) as { data: string };
  assert.equal(Buffer.from(sent.data, 'base64').toString('utf8'), 'あé');
  socket.close();
});

test('base64 output decoding preserves raw UTF-8 bytes', async () => {
  const wsModule = await import('../src/ws.ts') as {
    decodeB64Bytes?: (data: string) => Uint8Array;
  };

  assert.equal(typeof wsModule.decodeB64Bytes, 'function');
  assert.deepEqual(
    wsModule.decodeB64Bytes?.(Buffer.from('あ').toString('base64')),
    new TextEncoder().encode('あ'),
  );
  assert.equal(wsModule.decodeB64Bytes?.('').length, 0);
});

test('reconnect resends the active attach and terminal size', async () => {
  FakeWebSocket.instances = [];
  const socket = new TerminalSocket({ onMessage: () => {} });
  const first = FakeWebSocket.instances[0];
  socket.attach('sid');
  socket.resize('sid', 120, 40);

  first.close();
  await new Promise((resolve) => setTimeout(resolve, 550));

  const second = FakeWebSocket.instances[1];
  assert.ok(second);
  second.onopen?.();
  assert.deepEqual(second.sent.map((data) => JSON.parse(data)), [
    { t: 'attach', sid: 'sid' },
    { t: 'resize', sid: 'sid', cols: 120, rows: 40 },
  ]);
  socket.close();
});
