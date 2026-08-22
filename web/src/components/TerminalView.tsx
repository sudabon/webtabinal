import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import { ImageAddon } from '@xterm/addon-image';
import '@xterm/xterm/css/xterm.css';
import { xtermViewOptions, type ResolvedTheme } from '../theme';
import type { AppConfig } from '../types';
import {
  applyClipboardShortcut,
  clipboardShortcutAction,
  installTerminalClipboardFacade,
  isTextFieldElement,
  postDesktopClipboardRead,
  requestClipboardPaste,
} from '../clipboard';
import { openExternalLink, shouldUseWebglRenderer } from '../util';
import { decodeB64Bytes, TerminalSocket } from '../ws';
import { shouldApplyTerminalFocus } from '../terminal-focus';
import { shiftEnterSequence, shouldForwardTerminalInput } from '../terminal-input';

type Props = {
  sessionId: string | null;
  socket: TerminalSocket | null;
  config: AppConfig | null;
  copyOnSelect: boolean;
  shiftEnterNewline: boolean;
  theme: ResolvedTheme;
  focusSeq: number;
  settingsOpen: boolean;
  memoOpen: boolean;
};

export function TerminalView({
  sessionId,
  socket,
  config,
  copyOnSelect,
  shiftEnterNewline,
  theme,
  focusSeq,
  settingsOpen,
  memoOpen,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const attachedRef = useRef<string | null>(null);
  const replayingRef = useRef(false);
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const copyOnSelectRef = useRef(copyOnSelect);
  copyOnSelectRef.current = copyOnSelect;
  const shiftEnterNewlineRef = useRef(shiftEnterNewline);
  shiftEnterNewlineRef.current = shiftEnterNewline;

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: config?.font_family || "Menlo, Monaco, 'Courier New', monospace",
      fontSize: config?.font_size || 14,
      scrollback: config?.scrollback_lines || 10000,
      allowProposedApi: true,
      ...xtermViewOptions(theme),
    });
    const fit = new FitAddon();
    const search = new SearchAddon();
    const links = new WebLinksAddon((_event, uri) => openExternalLink(uri));
    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(links);
    term.open(hostRef.current);
    if (shouldUseWebglRenderer()) {
      try {
        term.loadAddon(new WebglAddon());
      } catch {
        /* DOM renderer fallback */
      }
    }
    try {
      term.loadAddon(new ImageAddon({
        kittySupport: true,
        enableSizeReports: true,
        sixelSupport: true,
        iipSupport: true,
      }));
    } catch {
      /* image protocols unavailable (WASM/CSP) */
    }
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const onData = term.onData((data) => {
      const sid = attachedRef.current;
      if (!sid || !shouldForwardTerminalInput(sid, replayingRef.current)) return;
      if (socketRef.current) socketRef.current.input(sid, data);
    });

    const onSel = term.onSelectionChange(() => {
      if (!copyOnSelectRef.current) return;
      const sel = term.getSelection();
      if (sel) void navigator.clipboard.writeText(sel);
    });

    const uninstallClipboard = installTerminalClipboardFacade({
      getSelection: () => term.getSelection(),
      paste: (text) => term.paste(text),
    });

    term.attachCustomKeyEventHandler((ev) => {
      const rewritten = shiftEnterSequence(ev, shiftEnterNewlineRef.current);
      if (rewritten) {
        const sid = attachedRef.current;
        if (sid && shouldForwardTerminalInput(sid, replayingRef.current) && socketRef.current) {
          socketRef.current.input(sid, rewritten);
        }
        ev.preventDefault();
        return false;
      }

      const action = clipboardShortcutAction(ev, {
        textFieldFocused: isTextFieldElement(document.activeElement),
      });
      const result = applyClipboardShortcut(action, {
        selection: term.getSelection(),
        writeText: (text) => {
          void navigator.clipboard.writeText(text).catch(() => {});
        },
        requestPaste: () => {
          requestClipboardPaste(postDesktopClipboardRead, () => {
            void navigator.clipboard.readText().then((text) => {
              if (text) term.paste(text);
            }).catch(() => {});
          });
        },
      });
      if (result === 'handled') {
        ev.preventDefault();
        return false;
      }
      return true;
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
      attachedRef.current = null;
      replayingRef.current = true;
      onData.dispose();
      onSel.dispose();
      uninstallClipboard();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
    };
    // Recreate on session switch so queued writes/OSC replies cannot follow the new sid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!shouldApplyTerminalFocus({ settingsOpen, memoOpen })) return;
    termRef.current?.focus();
  }, [sessionId, focusSeq, settingsOpen, memoOpen]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const opts = xtermViewOptions(theme);
    term.options.theme = opts.theme;
    term.options.minimumContrastRatio = opts.minimumContrastRatio;
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
    replayingRef.current = true;
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
      replayingRef.current = true;
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
        const sid = msg.sid;
        const finishReplay = () => {
          if (attachedRef.current === sid) replayingRef.current = false;
        };
        if (bytes.length > 0) {
          term.write(bytes, msg.done ? finishReplay : undefined);
        } else if (msg.done) {
          term.write('', finishReplay);
        }
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

  // FitAddon measures hostRef's parent box. Keep padding on .terminal-host and
  // open into a padding-free .terminal-fit so rows are not over-counted/clipped.
  return (
    <div className="terminal-host">
      <div className="terminal-fit" ref={hostRef} />
    </div>
  );
}
