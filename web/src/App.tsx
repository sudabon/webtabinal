import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { Sidebar } from './components/Sidebar';
import { TerminalView } from './components/TerminalView';
import type { AppConfig, ServerMsg, SessionInfo } from './types';
import { cwdBasename, isStandalone } from './util';
import { TerminalSocket } from './ws';

export default function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [socket, setSocket] = useState<TerminalSocket | null>(null);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [emptyVisible, setEmptyVisible] = useState(false);
  const prevCount = useRef<number | null>(null);
  const bootstrapped = useRef(false);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const configRef = useRef(config);
  configRef.current = config;
  const focusedRef = useRef(document.hasFocus());

  const badgeCount = unread.size;

  useEffect(() => {
    const onFocus = () => { focusedRef.current = true; };
    const onBlur = () => { focusedRef.current = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    if ('setAppBadge' in navigator) {
      if (badgeCount > 0) void (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(badgeCount);
      else void (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.();
    }
  }, [badgeCount]);

  useEffect(() => {
    const active = sessions.find((s) => s.id === activeId);
    const name = active ? cwdBasename(active.cwd) : 'WebTabinal';
    document.title = active ? `${name} — WebTabinal` : 'WebTabinal';
  }, [sessions, activeId]);

  useEffect(() => {
    const running = sessions.some((s) => s.state === 'running');
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!running) return;
      if (configRef.current && configRef.current.confirm_close_running === false) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [sessions]);

  const notifyCompletion = useCallback((sid: string, info: SessionInfo) => {
    const cfg = configRef.current;
    if (!cfg?.notification.enabled) return;
    const active = activeRef.current === sid;
    const focused = focusedRef.current;
    if (!cfg.notification.always && active && focused) return;
    if (cfg.notification.min_duration_ms > 0 && (info.run_ms ?? 0) < cfg.notification.min_duration_ms) return;

    if (!active) {
      setUnread((prev) => new Set(prev).add(sid));
    }

    if (Notification.permission === 'granted') {
      const ok = info.exit === 0 || info.exit == null;
      const title = `${ok ? '✓' : '✗'} ${info.command}${ok ? '' : ` (exit ${info.exit})`}`;
      const body = `${cwdBasename(info.cwd)} ・ ${Math.round((info.run_ms ?? 0) / 1000)}s`;
      const n = new Notification(title, { body });
      n.onclick = () => {
        window.focus();
        setActiveId(sid);
      };
    }
  }, []);

  useEffect(() => {
    let sock: TerminalSocket | null = null;
    let cancelled = false;
    (async () => {
      const cfg = await api.getConfig();
      if (cancelled) return;
      setConfig(cfg);

      if (isStandalone() && Notification.permission === 'default') {
        void Notification.requestPermission();
      }

      sock = new TerminalSocket({
        onMessage: (msg) => {
          window.dispatchEvent(new CustomEvent('webtabinal-ws', { detail: msg }));
          handleMsg(msg);
        },
      });
      setSocket(sock);

      function handleMsg(msg: ServerMsg) {
        if (msg.t === 'sessions') {
          setSessions(msg.list);
          setActiveId((cur) => {
            if (cur && msg.list.some((s) => s.id === cur)) return cur;
            return msg.list[0]?.id ?? null;
          });
        }
        if (msg.t === 'state') {
          setSessions((prev) => {
            const next = prev.map((s) => {
              if (s.id !== msg.sid) return s;
              const wasRunning = s.state === 'running';
              const updated: SessionInfo = {
                ...s,
                cwd: msg.cwd,
                command: msg.cmd,
                state: msg.state,
                exit: msg.exit,
                integrated: msg.integrated,
                run_ms: msg.run_ms,
              };
              if (wasRunning && msg.state === 'idle') {
                queueMicrotask(() => notifyCompletion(msg.sid, { ...updated, run_ms: s.run_ms }));
              }
              return updated;
            });
            return next;
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      sock?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bootstrapped.current && sessions.length === 0 && socket) {
      bootstrapped.current = true;
      void api.createSession().catch(() => setEmptyVisible(true));
    }
  }, [sessions, socket]);

  useEffect(() => {
    const count = sessions.length;
    if (prevCount.current === 1 && count === 0) {
      const quit = config?.quit_when_no_tabs !== false;
      if (quit && isStandalone()) {
        window.close();
        window.setTimeout(() => setEmptyVisible(true), 300);
      } else {
        setEmptyVisible(true);
      }
    }
    if (count > 0) setEmptyVisible(false);
    prevCount.current = count;
  }, [sessions, config]);

  const select = (id: string) => {
    setActiveId(id);
    setUnread((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const createTab = async () => {
    const s = await api.createSession();
    setActiveId(s.id);
  };

  const closeTab = async (id: string) => {
    const s = sessions.find((x) => x.id === id);
    if (s?.state === 'running' && config?.confirm_close_running !== false) {
      if (!window.confirm('このタブは実行中です。閉じますか？')) return;
    }
    await api.deleteSession(id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1;
        const s = sessionsRef.current[idx];
        if (s) {
          e.preventDefault();
          select(s.id);
        }
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        void createTab();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const width = config?.sidebar_width ?? 240;

  const onResizeWidth = useMemo(
    () => async (w: number) => {
      setConfig((c) => (c ? { ...c, sidebar_width: w } : c));
      try {
        const next = await api.patchConfig({ sidebar_width: w });
        setConfig(next);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  if (emptyVisible && sessions.length === 0) {
    return (
      <div className="empty">
        <h1>すべてのタブを閉じました</h1>
        <button type="button" onClick={() => void createTab()}>
          ＋ 新規タブ
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        width={width}
        unread={unread}
        onSelect={select}
        onNew={() => void createTab()}
        onReorder={(ids) => void api.reorderSessions(ids)}
        onDuplicate={(id) => void api.duplicateSession(id).then((s) => setActiveId(s.id))}
        onRestart={(id) => void api.restartSession(id).then((s) => setActiveId(s.id))}
        onClose={(id) => void closeTab(id)}
        onResizeWidth={(w) => void onResizeWidth(w)}
      />
      <main className="main">
        <TerminalView
          sessionId={activeId}
          socket={socket}
          config={config}
          copyOnSelect={!!config?.copy_on_select}
        />
      </main>
    </div>
  );
}
