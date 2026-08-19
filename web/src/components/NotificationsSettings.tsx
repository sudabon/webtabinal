import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationPermissionState } from '../notification-provider';
import type { NotificationConfig, StateConfig } from '../types';

type MutableNotificationSetting = 'enabled' | 'always';
type MutableStateFlag = 'enabled' | 'notify_on_blocked';
type NumericStateKey = 'debounce_ms' | 'quiescence_ms' | 'bottom_lines';

type Props = {
  notification: NotificationConfig;
  state: StateConfig;
  permissionState: NotificationPermissionState;
  onNotificationChange: (patch: Partial<NotificationConfig>) => void | Promise<void>;
  onStateChange: (patch: Partial<StateConfig>) => void | Promise<void>;
  onPermissionRefresh: () => Promise<NotificationPermissionState>;
  onPermissionRequest: () => Promise<NotificationPermissionState>;
};

const PERMISSION_COPY: Record<NotificationPermissionState, { label: string; guidance: string }> = {
  default: {
    label: 'システム通知の許可が必要です',
    guidance: '下のボタンを押すと、macOS またはブラウザの通知許可を確認します。',
  },
  granted: {
    label: 'システム通知は許可されています',
    guidance: 'WebTabinal からの通知を受け取れます。',
  },
  denied: {
    label: 'システム通知は許可されていません',
    guidance: 'macOS の「システム設定 > 通知」またはブラウザのサイト設定で WebTabinal を許可してください。',
  },
  unsupported: {
    label: 'この環境ではシステム通知を利用できません',
    guidance: '通知 API または macOS デスクトップ通知ブリッジが利用できる環境で開いてください。',
  },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function NotificationsSettings({
  notification,
  state,
  permissionState,
  onNotificationChange,
  onStateChange,
  onPermissionRefresh,
  onPermissionRequest,
}: Props) {
  const [values, setValues] = useState(notification);
  const [commandDraft, setCommandDraft] = useState('');
  const [stateValues, setStateValues] = useState(state);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [permission, setPermission] = useState(permissionState);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const persistedRef = useRef(notification);
  const persistedStateRef = useRef(state);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setValues(notification);
    persistedRef.current = notification;
  }, [notification]);

  useEffect(() => {
    setStateValues(state);
    persistedStateRef.current = state;
  }, [state]);

  useEffect(() => {
    setPermission(permissionState);
  }, [permissionState]);

  const refreshPermission = useCallback(async () => {
    try {
      const next = await onPermissionRefresh();
      setPermission(next);
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [onPermissionRefresh]);

  useEffect(() => {
    void refreshPermission();
    const onFocus = () => { void refreshPermission(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshPermission]);

  const commit = useCallback(async (key: MutableNotificationSetting, checked: boolean) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSaving(true);
    setError(null);
    setValues((current) => ({ ...current, [key]: checked }));
    try {
      await onNotificationChange({ [key]: checked });
      persistedRef.current = { ...persistedRef.current, [key]: checked };
    } catch (saveError) {
      setValues(persistedRef.current);
      setError(errorMessage(saveError));
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }, [onNotificationChange]);

  const commitCommands = useCallback(async (next: string[]) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSaving(true);
    setError(null);
    setValues((current) => ({ ...current, commands: next }));
    try {
      await onNotificationChange({ commands: next });
      persistedRef.current = { ...persistedRef.current, commands: next };
    } catch (saveError) {
      setValues(persistedRef.current);
      setError(errorMessage(saveError));
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }, [onNotificationChange]);

  const addCommand = useCallback(async () => {
    const name = commandDraft.trim();
    // Matching ignores case, so a case-only variant would be a dead duplicate.
    const exists = values.commands.some((entry) => entry.toLowerCase() === name.toLowerCase());
    if (!name || exists) return;
    setCommandDraft('');
    await commitCommands([...values.commands, name]);
  }, [commandDraft, commitCommands, values.commands]);

  const removeCommand = useCallback(async (name: string) => {
    await commitCommands(values.commands.filter((entry) => entry !== name));
  }, [commitCommands, values.commands]);

  const commitStateFlag = useCallback(async (key: MutableStateFlag, checked: boolean) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSaving(true);
    setError(null);
    setStateValues((current) => ({ ...current, [key]: checked }));
    try {
      await onStateChange({ [key]: checked });
      persistedStateRef.current = { ...persistedStateRef.current, [key]: checked };
    } catch (saveError) {
      setStateValues(persistedStateRef.current);
      setError(errorMessage(saveError));
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }, [onStateChange]);

  const commitStateValue = useCallback(async (patch: Partial<StateConfig>) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSaving(true);
    setError(null);
    setStateValues((current) => ({ ...current, ...patch }));
    try {
      await onStateChange(patch);
      persistedStateRef.current = { ...persistedStateRef.current, ...patch };
    } catch (saveError) {
      setStateValues(persistedStateRef.current);
      setError(errorMessage(saveError));
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }, [onStateChange]);

  const commitNumeric = useCallback((key: NumericStateKey, raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed === persistedStateRef.current[key]) {
      setStateValues(persistedStateRef.current);
      return;
    }
    void commitStateValue({ [key]: parsed });
  }, [commitStateValue]);

  const requestPermission = useCallback(async () => {
    setError(null);
    const pending = onPermissionRequest();
    setRequesting(true);
    try {
      setPermission(await pending);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setRequesting(false);
    }
  }, [onPermissionRequest]);

  const permissionCopy = PERMISSION_COPY[permission];
  const detectionOn = stateValues.enabled;
  const dependentsDisabled = saving || !detectionOn;

  return (
    <section className="settings-section notification-settings">
      <h3 className="settings-heading">アプリ内の通知設定</h3>
      <div className="settings-options">
        <label
          className={`settings-option ${values.enabled ? 'selected' : ''}`}
          htmlFor="notification-enabled"
        >
          <input
            id="notification-enabled"
            type="checkbox"
            checked={values.enabled}
            disabled={saving}
            onChange={(event) => { void commit('enabled', event.target.checked); }}
          />
          <span className="settings-option-label">通知を有効にする</span>
          <span className="settings-option-hint">完了・入力待ちを通知</span>
        </label>
        <label
          className={`settings-option ${values.always ? 'selected' : ''}`}
          htmlFor="notification-always"
        >
          <input
            id="notification-always"
            type="checkbox"
            checked={values.always}
            disabled={saving}
            onChange={(event) => { void commit('always', event.target.checked); }}
          />
          <span className="settings-option-label">操作中も通知する</span>
          <span className="settings-option-hint">前面のアクティブタブも対象</span>
        </label>
      </div>

      <h3 className="settings-heading">通知するコマンド</h3>
      <p className="settings-note">
        ここに挙げたコマンドのセッションだけが通知を出します（完了・入力待ち・ターン完了のすべて）。
        一覧が空のときはすべてのセッションが通知します。通知を全部止めるときは「通知を有効にする」をオフにしてください。
        一覧から外れたセッションもタブの未読ドットは付きます。
      </p>
      <div className="settings-command-list">
        {values.commands.length === 0
          ? <span className="settings-command-empty">すべてのセッションが通知します</span>
          : values.commands.map((name) => (
            <button
              key={name}
              type="button"
              className="settings-command-chip"
              data-command={name}
              disabled={saving}
              aria-label={`${name} を通知するコマンドから外す`}
              onClick={() => { void removeCommand(name); }}
            >
              {name}
              <span aria-hidden="true">×</span>
            </button>
          ))}
      </div>
      <form
        className="settings-command-add"
        onSubmit={(event) => { event.preventDefault(); void addCommand(); }}
      >
        <input
          id="notification-command-input"
          type="text"
          value={commandDraft}
          placeholder="コマンド名（例: make）"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          disabled={saving}
          onChange={(event) => setCommandDraft(event.target.value)}
        />
        <button type="submit" disabled={saving || commandDraft.trim() === ''}>追加</button>
      </form>

      <h3 className="settings-heading">エージェント状態</h3>
      <div className="settings-options">
        <label
          className={`settings-option ${stateValues.enabled ? 'selected' : ''}`}
          htmlFor="state-enabled"
        >
          <input
            id="state-enabled"
            type="checkbox"
            checked={stateValues.enabled}
            disabled={saving}
            onChange={(event) => { void commitStateFlag('enabled', event.target.checked); }}
          />
          <span className="settings-option-label">状態検出を有効にする</span>
          <span className="settings-option-hint">画面から idle / working / blocked を表示</span>
        </label>
        <label
          className={`settings-option ${stateValues.notify_on_blocked ? 'selected' : ''} ${!detectionOn ? 'dependent-disabled' : ''}`}
          htmlFor="state-notify-blocked"
        >
          <input
            id="state-notify-blocked"
            type="checkbox"
            checked={stateValues.notify_on_blocked}
            disabled={dependentsDisabled}
            onChange={(event) => { void commitStateFlag('notify_on_blocked', event.target.checked); }}
          />
          <span className="settings-option-label">blocked を通知する</span>
          <span className="settings-option-hint">入力待ちへの遷移を通知。OSC 通知は維持</span>
        </label>
      </div>

      <div className="settings-advanced">
        <button
          className="settings-advanced-toggle"
          type="button"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          {advancedOpen ? '詳細設定を隠す' : '詳細設定'}
        </button>
        {advancedOpen ? (
          <div className="settings-advanced-body">
            <label className="settings-field" htmlFor="state-debounce">
              <span className="settings-option-label">デバウンス (ms)</span>
              <input
                id="state-debounce"
                className="settings-input"
                type="number"
                min={20}
                max={5000}
                disabled={dependentsDisabled}
                value={stateValues.debounce_ms}
                aria-describedby="state-debounce-hint"
                onChange={(event) => setStateValues((current) => ({ ...current, debounce_ms: Number(event.target.value) }))}
                onBlur={(event) => commitNumeric('debounce_ms', event.target.value)}
              />
              <span id="state-debounce-hint" className="settings-field-hint">20–5000。画面評価の最短間隔</span>
            </label>
            <label className="settings-field" htmlFor="state-quiescence">
              <span className="settings-option-label">静止時間 (ms)</span>
              <input
                id="state-quiescence"
                className="settings-input"
                type="number"
                min={0}
                max={60000}
                disabled={dependentsDisabled}
                value={stateValues.quiescence_ms}
                aria-describedby="state-quiescence-hint"
                onChange={(event) => setStateValues((current) => ({ ...current, quiescence_ms: Number(event.target.value) }))}
                onBlur={(event) => commitNumeric('quiescence_ms', event.target.value)}
              />
              <span id="state-quiescence-hint" className="settings-field-hint">0–60000。マニフェスト指定があればそちらが優先されます</span>
            </label>
            <label className="settings-field" htmlFor="state-bottom-lines">
              <span className="settings-option-label">判定する末尾行数</span>
              <input
                id="state-bottom-lines"
                className="settings-input"
                type="number"
                min={1}
                max={200}
                disabled={dependentsDisabled}
                value={stateValues.bottom_lines}
                aria-describedby="state-bottom-lines-hint"
                onChange={(event) => setStateValues((current) => ({ ...current, bottom_lines: Number(event.target.value) }))}
                onBlur={(event) => commitNumeric('bottom_lines', event.target.value)}
              />
              <span id="state-bottom-lines-hint" className="settings-field-hint">1–200。マニフェスト指定があればそちらが優先されます</span>
            </label>
            <label className="settings-field" htmlFor="state-manifest-dir">
              <span className="settings-option-label">マニフェストディレクトリ</span>
              <input
                id="state-manifest-dir"
                className="settings-input"
                type="text"
                spellCheck={false}
                autoComplete="off"
                disabled={dependentsDisabled}
                value={stateValues.manifest_dir}
                aria-describedby="state-manifest-dir-hint"
                onChange={(event) => setStateValues((current) => ({ ...current, manifest_dir: event.target.value }))}
                onBlur={(event) => {
                  const next = event.target.value.trim();
                  if (next === persistedStateRef.current.manifest_dir) return;
                  void commitStateValue({ manifest_dir: next });
                }}
              />
              <span id="state-manifest-dir-hint" className="settings-field-hint">
                空欄は Application Support の既定ディレクトリを使います。変更はデーモン再起動後に読み込まれます
              </span>
            </label>
          </div>
        ) : null}
      </div>

      <div
        className="notification-permission"
        data-notification-permission={permission}
        aria-live="polite"
      >
        <h3 className="settings-heading">システムの通知許可</h3>
        <p className="notification-permission-label">{permissionCopy.label}</p>
        <p className="settings-field-hint">{permissionCopy.guidance}</p>
        {permission === 'default' ? (
          <button
            className="settings-action"
            type="button"
            disabled={requesting}
            onClick={() => { void requestPermission(); }}
          >
            {requesting ? '確認中…' : '通知を許可'}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="settings-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
