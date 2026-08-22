import assert from 'node:assert/strict';
import test from 'node:test';

import { loadInitialConfig } from '../src/boot.ts';
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

test('input sends UTF-8 bytes for non-Latin-1 text', async () => {
  FakeWebSocket.instances = [];
  const socket = new TerminalSocket({ onMessage: () => {} });

  socket.input('sid', 'あé');
  await Promise.resolve();

  const sent = JSON.parse(FakeWebSocket.instances[0].sent[0]) as { data: string };
  assert.equal(Buffer.from(sent.data, 'base64').toString('utf8'), 'あé');
  socket.close();
});

test('kitty probe replies in the same tick share one PTY write', async () => {
  FakeWebSocket.instances = [];
  const socket = new TerminalSocket({ onMessage: () => {} });

  socket.input('sid', '\x1b_Gi=4207;OK\x1b\\');
  socket.input('sid', '\x1b[?62;4;9;22c');
  assert.equal(FakeWebSocket.instances[0].sent.length, 0);
  await Promise.resolve();

  assert.equal(FakeWebSocket.instances[0].sent.length, 1);
  const sent = JSON.parse(FakeWebSocket.instances[0].sent[0]) as { t: string; sid: string; data: string };
  assert.equal(sent.t, 'input');
  assert.equal(sent.sid, 'sid');
  assert.equal(
    Buffer.from(sent.data, 'base64').toString('binary'),
    '\x1b_Gi=4207;OK\x1b\\\x1b[?62;4;9;22c',
  );
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

test('reconnect notifies onStatus(true) before re-attach so UI can reset', async () => {
  FakeWebSocket.instances = [];
  const status: boolean[] = [];
  const socket = new TerminalSocket({
    onMessage: () => {},
    onStatus: (connected) => {
      status.push(connected);
    },
  });
  const first = FakeWebSocket.instances[0];
  first.onopen?.();
  assert.deepEqual(status, [true]);

  socket.attach('sid');
  first.close();
  assert.deepEqual(status, [true, false]);

  await new Promise((resolve) => setTimeout(resolve, 550));
  const second = FakeWebSocket.instances[1];
  assert.ok(second);

  let statusBeforeSend = false;
  const originalSend = second.send.bind(second);
  second.send = (data: string) => {
    if (!statusBeforeSend) {
      statusBeforeSend = status.at(-1) === true && status.filter((v) => v).length >= 2;
    }
    originalSend(data);
  };
  second.onopen?.();

  assert.equal(status.at(-1), true);
  assert.ok(statusBeforeSend, 'onStatus(true) must run before attach is sent');
  assert.deepEqual(JSON.parse(second.sent[0]), { t: 'attach', sid: 'sid' });
  socket.close();
});

test('loadInitialConfig surfaces getConfig rejection for boot UI', async () => {
  const failed = await loadInitialConfig(async () => {
    throw new Error('config unavailable');
  });
  assert.deepEqual(failed, { ok: false, error: 'config unavailable' });

  const ok = await loadInitialConfig(async () => ({
    port: 8642,
    shell: '/bin/zsh',
    scrollback_lines: 10000,
    ring_buffer_bytes: 1,
    font_family: 'Menlo',
    font_size: 14,
    sidebar_width: 240,
    notification: { enabled: true, always: false, min_duration_ms: 0, sound: false },
    confirm_close_running: true,
    copy_on_select: false,
    quit_when_no_tabs: true,
    close_tab_on_clean_exit: false,
  }));
  assert.equal(ok.ok, true);
});
