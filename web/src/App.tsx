import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { bootErrorMessage, loadInitialConfig } from './boot';
import { isTextFieldElement } from './clipboard';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { TabMemoModal } from './components/TabMemoModal';
import { TerminalView } from './components/TerminalView';
import {
  CHORD_TIMEOUT_MS,
  DEFAULT_KEY_BINDINGS,
  formatBinding,
  neighbourTabIndex,
  normalizeKeyEvent,
  resolveChordKey,
  type KeyBindings,
} from './keymap';
import {
  createNotificationProvider,
  NATIVE_NOTIFICATION_ACTIVATION_EVENT,
  type NotificationPermissionState,
} from './notification-provider';
import { useColorScheme } from './theme';
import { agentWaitContent, shouldRaiseDesktopNotification } from './notify';
import { applyServerMessage } from './session-state';
import type {
  AppConfig,
  ColorScheme,
  NotificationConfig,
  ServerMsg,
  SessionInfo,
  StateConfig,
} from './types';
import { cwdBasename, isStandalone, sessionBootstrapAction } from './util';
import { TerminalSocket } from './ws';

const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  always: false,
  min_duration_ms: 0,
  sound: false,
};

export const DEFAULT_STATE_CONFIG: StateConfig = {
  enabled: true,
  debounce_ms: 120,
  quiescence_ms: 1500,
  bottom_lines: 15,
  notify_on_blocked: true,
  manifest_dir: '',
};

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
  const [pendingPrefix, setPendingPrefix] = useState(false);
  const [focusSeq, setFocusSeq] = useState(0);
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
  const settingsOpenRef = useRef(settingsOpen);
  settingsOpenRef.current = settingsOpen;
  const memoOpenRef = useRef(memoSessionId != null);
  memoOpenRef.current = memoSessionId != null;
  const pendingPrefixRef = useRef(false);
  const pendingTimerRef = useRef(0);
  const colorSchemeRequest = useRef(0);
  const lastSuccessColorSchemeRequest = useRef(0);
  const lastCommittedColorScheme = useRef<ColorScheme | undefined>(undefined);

  const theme = useColorScheme(config?.color_scheme);
  const badgeCount = unread.size;
  const notificationProvider = useMemo(() => createNotificationProvider(), []);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(
    notificationProvider.kind === 'unsupported' ? 'unsupported' : 'default',
  );

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

  const clearPending = useCallback(() => {
    if (pendingTimerRef.current) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = 0;
    }
    pendingPrefixRef.current = false;
    setPendingPrefix(false);
  }, []);

  const armPending = useCallback(() => {
    if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    pendingPrefixRef.current = true;
    setPendingPrefix(true);
    pendingTimerRef.current = window.setTimeout(() => {
      pendingTimerRef.current = 0;
      pendingPrefixRef.current = false;
      setPendingPrefix(false);
    }, CHORD_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const onFocus = () => { focusedRef.current = true; };
    const onBlur = () => {
      focusedRef.current = false;
      clearPending();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [clearPending]);

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

  const select = useCallback((id: string) => {
    setActiveId(id);
    setFocusSeq((n) => n + 1);
    setUnread((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const onActivate = (event: Event) => {
      const sid = (event as CustomEvent<unknown>).detail;
      if (typeof sid !== 'string' || !sessionsRef.current.some((session) => session.id === sid)) return;
      select(sid);
    };
    window.addEventListener(NATIVE_NOTIFICATION_ACTIVATION_EVENT, onActivate);
    return () => window.removeEventListener(NATIVE_NOTIFICATION_ACTIVATION_EVENT, onActivate);
  }, [select]);

  const showNotification = useCallback((sid: string, title: string, body: string) => {
    void notificationProvider.show({
      sid,
      title,
      body,
      onActivate: () => select(sid),
    }).catch((err: unknown) => {
      console.error('Failed to deliver notification', err);
    });
  }, [notificationProvider, select]);

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

    const ok = info.exit === 0 || info.exit == null;
    const title = `${ok ? '✓' : '✗'} ${info.command}${ok ? '' : ` (exit ${info.exit})`}`;
    const body = `${cwdBasename(info.cwd)} ・ ${Math.round((info.run_ms ?? 0) / 1000)}s`;
    showNotification(sid, title, body);
  }, [showNotification]);

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

    showNotification(sid, content.title, content.body);
  }, [showNotification]);

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
        if (msg.t === 'sessions' || msg.t === 'state' || msg.t === 'agent_state') {
          if (msg.t === 'sessions') {
            setSessionsLoaded(true);
            setActiveId((cur) => {
              if (cur && msg.list.some((s) => s.id === cur)) return cur;
              return msg.list[0]?.id ?? null;
            });
          }
          if (msg.t === 'state') {
            setSessions((prev) => {
              const next = applyServerMessage(prev, msg);
              const current = prev.find((s) => s.id === msg.sid);
              const updated = next.find((s) => s.id === msg.sid);
              if (current?.state === 'running' && msg.state === 'idle' && updated) {
                queueMicrotask(() => notifyCompletion(msg.sid, updated));
              }
              return next;
            });
            return;
          }
          setSessions((prev) => applyServerMessage(prev, msg));
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

  const createTab = useCallback(async () => {
    try {
      const s = await api.createSession();
      setBootError(null);
      setActiveId(s.id);
      setFocusSeq((n) => n + 1);
    } catch (err) {
      reportActionError(err);
      if (emptyVisible) {
        setBootError(bootErrorMessage(err));
      }
    }
  }, [emptyVisible, reportActionError]);

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
  }, [settingsOpen, select, createTab]);

  useEffect(() => {
    if (settingsOpen || memoSessionId != null) clearPending();
  }, [settingsOpen, memoSessionId, clearPending]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const bindings = configRef.current?.key_bindings;
      if (!bindings?.enabled) return;
      if (settingsOpenRef.current || memoOpenRef.current) return;
      if (isTextFieldElement(document.activeElement)) return;

      const spec = normalizeKeyEvent(e);
      const result = resolveChordKey(pendingPrefixRef.current, spec, bindings);
      if (result.action === 'none') return;

      e.preventDefault();
      e.stopPropagation();

      if (result.action === 'arm') {
        armPending();
        return;
      }
      clearPending();
      if (result.action !== 'next' && result.action !== 'prev') return;
      const list = sessionsRef.current;
      const activeIndex = list.findIndex((s) => s.id === activeRef.current);
      const nextIndex = neighbourTabIndex(list.length, activeIndex, result.action);
      const target = nextIndex >= 0 ? list[nextIndex] : undefined;
      if (target) select(target.id);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [armPending, clearPending, select]);

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

  const changeKeyBindings = useCallback(
    async (key_bindings: KeyBindings) => {
      try {
        const next = await api.patchConfig({ key_bindings });
        setConfig(next);
      } catch (err) {
        reportActionError(err);
        throw err;
      }
    },
    [reportActionError],
  );

  const changeShiftEnterNewline = useCallback(
    async (shift_enter_newline: boolean) => {
      try {
        const next = await api.patchConfig({ shift_enter_newline });
        setConfig(next);
      } catch (err) {
        reportActionError(err);
        throw err;
      }
    },
    [reportActionError],
  );

  const changeNotification = useCallback(
    async (patch: Partial<NotificationConfig>) => {
      try {
        const next = await api.patchConfig({ notification: patch });
        setConfig(next);
      } catch (err) {
        reportActionError(err);
        throw err;
      }
    },
    [reportActionError],
  );

  const changeState = useCallback(
    async (patch: Partial<StateConfig>) => {
      try {
        const next = await api.patchConfig({ state: patch });
        setConfig(next);
      } catch (err) {
        reportActionError(err);
        throw err;
      }
    },
    [reportActionError],
  );

  const refreshNotificationPermission = useCallback(async () => {
    const permission = await notificationProvider.getPermission();
    setNotificationPermission(permission);
    return permission;
  }, [notificationProvider]);

  const requestNotificationPermission = useCallback(async () => {
    const permission = await notificationProvider.requestPermission();
    setNotificationPermission(permission);
    return permission;
  }, [notificationProvider]);

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
          shiftEnterNewline={config?.shift_enter_newline !== false}
          theme={theme}
          focusSeq={focusSeq}
          settingsOpen={settingsOpen}
          memoOpen={memoSessionId != null}
        />
      </main>
      {pendingPrefix && (
        <div className="chord-pending" role="status">
          {formatBinding((config?.key_bindings ?? DEFAULT_KEY_BINDINGS).prefix)} …
        </div>
      )}
      <SettingsModal
        open={settingsOpen}
        colorScheme={config?.color_scheme ?? 'system'}
        onColorSchemeChange={(scheme) => void changeColorScheme(scheme)}
        shell={config?.shell ?? '/bin/zsh'}
        onShellChange={changeShell}
        keyBindings={config?.key_bindings ?? DEFAULT_KEY_BINDINGS}
        onKeyBindingsChange={changeKeyBindings}
        shiftEnterNewline={config?.shift_enter_newline !== false}
        onShiftEnterNewlineChange={changeShiftEnterNewline}
        notification={config?.notification ?? DEFAULT_NOTIFICATION_CONFIG}
        notificationPermission={notificationPermission}
        onNotificationChange={changeNotification}
        state={config?.state ?? DEFAULT_STATE_CONFIG}
        onStateChange={changeState}
        onNotificationPermissionRefresh={refreshNotificationPermission}
        onNotificationPermissionRequest={requestNotificationPermission}
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
