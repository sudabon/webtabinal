import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { terminalTheme, type ResolvedTheme } from '../theme';
import type { AppConfig } from '../types';
import { openExternalLink } from '../util';
import { decodeB64Bytes, TerminalSocket } from '../ws';

type Props = {
  sessionId: string | null;
  socket: TerminalSocket | null;
  config: AppConfig | null;
  copyOnSelect: boolean;
  theme: ResolvedTheme;
};

export function TerminalView({ sessionId, socket, config, copyOnSelect, theme }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const attachedRef = useRef<string | null>(null);
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const copyOnSelectRef = useRef(copyOnSelect);
  copyOnSelectRef.current = copyOnSelect;

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: config?.font_family || "Menlo, Monaco, 'Courier New', monospace",
      fontSize: config?.font_size || 14,
      scrollback: config?.scrollback_lines || 10000,
      theme: terminalTheme[theme],
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    const search = new SearchAddon();
    const links = new WebLinksAddon((_event, uri) => openExternalLink(uri));
    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(links);
    term.open(hostRef.current);
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      /* canvas fallback */
    }
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const onData = term.onData((data) => {
      const sid = attachedRef.current;
      if (sid && socketRef.current) socketRef.current.input(sid, data);
    });

    const onSel = term.onSelectionChange(() => {
      if (!copyOnSelectRef.current) return;
      const sel = term.getSelection();
      if (sel) void navigator.clipboard.writeText(sel);
    });

    const ro = new ResizeObserver(() => {
      fit.fit();
      const sid = attachedRef.current;
      if (sid && socketRef.current && term.cols && term.rows) {
        socketRef.current.resize(sid, term.cols, term.rows);
      }
    });
    ro.observe(hostRef.current);

    return () => {
      onData.dispose();
      onSel.dispose();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = terminalTheme[theme];
  }, [theme]);

  useEffect(() => {
    const term = termRef.current;
    if (!term || !config) return;
    term.options.fontFamily = config.font_family;
    term.options.fontSize = config.font_size;
    term.options.scrollback = config.scrollback_lines;
    fitRef.current?.fit();
  }, [config]);

  useEffect(() => {
    if (!sessionId || !socket || !termRef.current) return;
    attachedRef.current = sessionId;
    termRef.current.reset();
    fitRef.current?.fit();
    socket.attach(sessionId);
    if (termRef.current.cols && termRef.current.rows) {
      socket.resize(sessionId, termRef.current.cols, termRef.current.rows);
    }
  }, [sessionId, socket]);

  useEffect(() => {
    const onReconnect = () => {
      const term = termRef.current;
      if (!term || !attachedRef.current) return;
      // Reconnect keeps the same socket/session refs; reset before replay is written.
      term.reset();
    };
    window.addEventListener('webtabinal-ws-reconnect', onReconnect);
    return () => window.removeEventListener('webtabinal-ws-reconnect', onReconnect);
  }, []);

  useEffect(() => {
    if (!socket || !termRef.current) return;
    const handler = (msg: import('../types').ServerMsg) => {
      const term = termRef.current;
      if (!term || !attachedRef.current) return;
      if (msg.t === 'replay' && msg.sid === attachedRef.current) {
        const bytes = decodeB64Bytes(msg.data);
        if (bytes.length > 0) term.write(bytes);
      }
      if (msg.t === 'output' && msg.sid === attachedRef.current) {
        const bytes = decodeB64Bytes(msg.data);
        if (bytes.length > 0) term.write(bytes);
      }
    };
    // monkey-patch: App will also route; expose via custom event
    const listener = (e: Event) => handler((e as CustomEvent).detail);
    window.addEventListener('webtabinal-ws', listener);
    return () => window.removeEventListener('webtabinal-ws', listener);
  }, [socket]);

  return <div className="terminal-host" ref={hostRef} />;
}
