import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { bootErrorMessage, loadInitialConfig } from './boot';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { TabMemoModal } from './components/TabMemoModal';
import { TerminalView } from './components/TerminalView';
import { useColorScheme } from './theme';
import { agentWaitContent, shouldRaiseDesktopNotification } from './notify';
import type { AppConfig, ColorScheme, ServerMsg, SessionInfo } from './types';
import { cwdBasename, isStandalone, sessionBootstrapAction } from './util';
import { TerminalSocket } from './ws';

export default function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [socket, setSocket] = useState<TerminalSocket | null>(null);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [emptyVisible, setEmptyVisible] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoSessionId, setMemoSessionId] = useState<string | null>(null);
  const prevCount = useRef<number | null>(null);
  const bootstrapped = useRef(false);
  const everConnected = useRef(false);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const configRef = useRef(config);
  configRef.current = config;
  const focusedRef = useRef(document.hasFocus());
  const colorSchemeRequest = useRef(0);
  const lastSuccessColorSchemeRequest = useRef(0);
  const lastCommittedColorScheme = useRef<ColorScheme | undefined>(undefined);

  const theme = useColorScheme(config?.color_scheme);
  const badgeCount = unread.size;

  const reportActionError = useCallback((err: unknown) => {
    const message = bootErrorMessage(err);
    console.error(err);
    setActionError(message);
  }, []);

  useEffect(() => {
    if (!actionError) return;
    const timer = window.setTimeout(() => setActionError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [actionError]);

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
    document.title = 'WebTabinal';
  }, []);

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
    if (!cfg) return;
    const active = activeRef.current === sid;
    const focused = focusedRef.current;
    if (!shouldRaiseDesktopNotification({
      enabled: cfg.notification.enabled,
      always: cfg.notification.always,
      active,
      focused,
      minDurationMs: cfg.notification.min_duration_ms,
      runMs: info.run_ms,
    })) return;

    if (!active) {
      setUnread((prev) => new Set(prev).add(sid));
    }

    if ('Notification' in window && Notification.permission === 'granted') {
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

  const notifyAgentWait = useCallback((sid: string, title: string, body: string) => {
    const cfg = configRef.current;
    if (!cfg) return;
    const content = agentWaitContent(title, body, sessionsRef.current.find((s) => s.id === sid)?.command);
    if (!content) return;
    const active = activeRef.current === sid;
    const focused = focusedRef.current;
    if (!shouldRaiseDesktopNotification({
      enabled: cfg.notification.enabled,
      always: cfg.notification.always,
      active,
      focused,
    })) return;

    if (!active) {
      setUnread((prev) => new Set(prev).add(sid));
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(content.title, { body: content.body });
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
      const loaded = await loadInitialConfig(() => api.getConfig());
      if (cancelled) return;
      if (!loaded.ok) {
        setBootError(loaded.error);
        setEmptyVisible(true);
        return;
      }
      setConfig(loaded.config);

      if (isStandalone() && 'Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }

      sock = new TerminalSocket({
        onMessage: (msg) => {
          window.dispatchEvent(new CustomEvent('webtabinal-ws', { detail: msg }));
          handleMsg(msg);
        },
        onStatus: (connected) => {
          if (!connected) return;
          if (everConnected.current) {
            window.dispatchEvent(new Event('webtabinal-ws-reconnect'));
          }
          everConnected.current = true;
        },
      });
      setSocket(sock);

      function handleMsg(msg: ServerMsg) {
        if (msg.t === 'sessions') {
          setSessionsLoaded(true);
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
                queueMicrotask(() => notifyCompletion(msg.sid, updated));
              }
              return updated;
            });
            return next;
          });
        }
        if (msg.t === 'notify') {
          queueMicrotask(() => notifyAgentWait(msg.sid, msg.title, msg.body));
        }
        if (msg.t === 'error') {
          setActionError(msg.message);
          if (msg.code === 'attach_overflow' && msg.sid) {
            window.dispatchEvent(new Event('webtabinal-ws-reconnect'));
            sock?.attach(msg.sid);
          }
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
    if (bootstrapped.current || !sessionsLoaded || !socket) return;
    const action = sessionBootstrapAction(sessions, activeId);
    if (action.type === 'none') {
      bootstrapped.current = true;
      return;
    }
    bootstrapped.current = true;
    const task = action.type === 'create'
      ? api.createSession()
      : api.restartSession(action.id).then((session) => {
          setActiveId(session.id);
          return session;
        });
    void task.catch((err: unknown) => {
      console.error(err);
      setBootError(bootErrorMessage(err));
      setEmptyVisible(true);
    });
  }, [sessions, sessionsLoaded, socket, activeId]);

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
    try {
      const s = await api.createSession();
      setBootError(null);
      setActiveId(s.id);
    } catch (err) {
      reportActionError(err);
      if (emptyVisible) {
        setBootError(bootErrorMessage(err));
      }
    }
  };

  const closeTab = async (id: string) => {
    const s = sessions.find((x) => x.id === id);
    if (s?.state === 'running' && config?.confirm_close_running !== false) {
      if (!window.confirm('このタブは実行中です。閉じますか？')) return;
    }
    try {
      await api.deleteSession(id);
    } catch (err) {
      reportActionError(err);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen) return;
      if (!e.metaKey) return;
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
  }, [settingsOpen]);

  const width = config?.sidebar_width ?? 240;

  const onResizeWidth = useMemo(
    () => (w: number) => {
      setConfig((c) => (c ? { ...c, sidebar_width: w } : c));
    },
    [],
  );

  const changeColorScheme = useCallback(
    async (scheme: ColorScheme) => {
      const request = ++colorSchemeRequest.current;
      lastCommittedColorScheme.current ??= configRef.current?.color_scheme;
      setConfig((c) => (c ? { ...c, color_scheme: scheme } : c));
      try {
        const next = await api.patchConfig({ color_scheme: scheme });
        if (request > lastSuccessColorSchemeRequest.current) {
          lastSuccessColorSchemeRequest.current = request;
          lastCommittedColorScheme.current = next.color_scheme;
        }
        if (request === colorSchemeRequest.current) {
          setConfig(next);
        } else if (request === lastSuccessColorSchemeRequest.current) {
          // Newer requests may have already failed; keep UI aligned with the
          // newest server-confirmed scheme even when this response is stale.
          setConfig((c) => (c ? { ...c, color_scheme: next.color_scheme } : c));
        }
      } catch (err) {
        if (request !== colorSchemeRequest.current) return;
        const committed = lastCommittedColorScheme.current;
        if (committed) setConfig((c) => (c ? { ...c, color_scheme: committed } : c));
        reportActionError(err);
      }
    },
    [reportActionError],
  );

  const onResizeWidthCommit = useMemo(
    () => async (w: number) => {
      try {
        const next = await api.patchConfig({ sidebar_width: w });
        setConfig(next);
      } catch (err) {
        reportActionError(err);
      }
    },
    [reportActionError],
  );

  const changeShell = useCallback(
    async (shell: string) => {
      try {
        const next = await api.patchConfig({ shell });
        setConfig(next);
      } catch (err) {
        reportActionError(err);
        throw err;
      }
    },
    [reportActionError],
  );

  if (emptyVisible && sessions.length === 0) {
    return (
      <div className="empty">
        <h1>{bootError ? '起動できませんでした' : 'すべてのタブを閉じました'}</h1>
        {bootError && <p>{bootError}</p>}
        <div className="empty-actions">
          {bootError && (
            <button type="button" onClick={() => window.location.reload()}>
              再試行
            </button>
          )}
          <button type="button" onClick={() => void createTab()}>
            ＋ 新規タブ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {actionError && (
        <div className="toast-error" role="alert">
          {actionError}
          <button type="button" aria-label="閉じる" onClick={() => setActionError(null)}>
            ×
          </button>
        </div>
      )}
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        width={width}
        unread={unread}
        memoEditorOpen={memoSessionId != null}
        onSelect={select}
        onEditMemo={(id) => {
          setActiveId(id);
          setMemoSessionId(id);
        }}
        onNew={() => void createTab()}
        onOpenSettings={() => setSettingsOpen(true)}
        onReorder={(ids) => {
          void api.reorderSessions(ids).catch(reportActionError);
        }}
        onDuplicate={(id) => {
          void api
            .duplicateSession(id)
            .then((s) => setActiveId(s.id))
            .catch(reportActionError);
        }}
        onRestart={(id) => {
          void api
            .restartSession(id)
            .then((s) => setActiveId(s.id))
            .catch(reportActionError);
        }}
        onClose={(id) => void closeTab(id)}
        onResizeWidth={onResizeWidth}
        onResizeWidthCommit={(w) => void onResizeWidthCommit(w)}
      />
      <main className="main">
        <TerminalView
          sessionId={activeId}
          socket={socket}
          config={config}
          copyOnSelect={!!config?.copy_on_select}
          theme={theme}
        />
      </main>
      <SettingsModal
        open={settingsOpen}
        colorScheme={config?.color_scheme ?? 'system'}
        onColorSchemeChange={(scheme) => void changeColorScheme(scheme)}
        shell={config?.shell ?? '/bin/zsh'}
        onShellChange={changeShell}
        onClose={() => setSettingsOpen(false)}
      />
      <TabMemoModal
        open={memoSessionId != null}
        initialMemo={sessions.find((s) => s.id === memoSessionId)?.memo ?? ''}
        onClose={() => setMemoSessionId(null)}
        onSave={async (memo) => {
          if (!memoSessionId) return;
          try {
            const updated = await api.patchSessionMemo(memoSessionId, memo);
            setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            setMemoSessionId(null);
          } catch (err) {
            reportActionError(err);
            throw err;
          }
        }}
      />
    </div>
  );
}
