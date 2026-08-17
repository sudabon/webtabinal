import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationPermissionState } from '../notification-provider';
import type { NotificationConfig } from '../types';

type MutableNotificationSetting = 'enabled' | 'always';

type Props = {
  notification: NotificationConfig;
  permissionState: NotificationPermissionState;
  onNotificationChange: (patch: Partial<NotificationConfig>) => void | Promise<void>;
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
  permissionState,
  onNotificationChange,
  onPermissionRefresh,
  onPermissionRequest,
}: Props) {
  const [values, setValues] = useState(notification);
  const [permission, setPermission] = useState(permissionState);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const persistedRef = useRef(notification);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setValues(notification);
    persistedRef.current = notification;
  }, [notification]);

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
