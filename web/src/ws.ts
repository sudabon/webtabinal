import type { ServerMsg } from './types';

function encodeB64(bytes: Uint8Array): string {
  let bin = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(bin);
}

type Handlers = {
  onMessage: (msg: ServerMsg) => void;
  onStatus?: (connected: boolean) => void;
};

export class TerminalSocket {
  private ws: WebSocket | null = null;
  private handlers: Handlers;
  private closed = false;
  private attempt = 0;
  private timer: number | null = null;
  private attached: string | null = null;
  private lastSize: { cols: number; rows: number } | null = null;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
    this.connect();
  }

  private url() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/api/ws`;
  }

  private connect() {
    if (this.closed) return;
    const ws = new WebSocket(this.url());
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      // Notify before re-attach so UI can reset the terminal before replay arrives.
      this.handlers.onStatus?.(true);
      if (this.attached) {
        this.send({ t: 'attach', sid: this.attached });
        if (this.lastSize) {
          this.send({ t: 'resize', sid: this.attached, ...this.lastSize });
        }
      }
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMsg;
        this.handlers.onMessage(msg);
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      this.handlers.onStatus?.(false);
      this.scheduleReconnect();
    };
    ws.onerror = () => {
      ws.close();
    };
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = Math.min(500 * 2 ** this.attempt, 5000);
    this.attempt += 1;
    this.timer = window.setTimeout(() => this.connect(), delay);
  }

  send(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  attach(sid: string) {
    this.attached = sid;
    this.send({ t: 'attach', sid });
  }

  input(sid: string, data: string) {
    this.send({ t: 'input', sid, data: encodeB64(new TextEncoder().encode(data)) });
  }

  resize(sid: string, cols: number, rows: number) {
    this.lastSize = { cols, rows };
    this.send({ t: 'resize', sid, cols, rows });
  }

  close() {
    this.closed = true;
    if (this.timer) window.clearTimeout(this.timer);
    this.ws?.close();
  }
}

export function decodeB64Bytes(data: string): Uint8Array {
  if (!data) return new Uint8Array();
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
