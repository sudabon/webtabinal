import { useEffect, useRef, useState } from 'react';
import type { NotificationPermissionState } from '../notification-provider';
import type { ColorScheme, KeyBindings, NotificationConfig, StateConfig } from '../types';
import { AppearanceSettings } from './AppearanceSettings';
import { GeneralSettings } from './GeneralSettings';
import { KeyboardSettings } from './KeyboardSettings';
import { NotificationsSettings } from './NotificationsSettings';

const CATEGORIES = [
  { id: 'appearance', label: '外観' },
  { id: 'general', label: '一般' },
  { id: 'notifications', label: '通知' },
  { id: 'keyboard', label: 'キーボード' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

type Props = {
  open: boolean;
  colorScheme: ColorScheme;
  onColorSchemeChange: (scheme: ColorScheme) => void;
  shell: string;
  onShellChange: (shell: string) => void | Promise<void>;
  restoreEnabled: boolean;
  onRestoreEnabledChange: (enabled: boolean) => void | Promise<void>;
  keyBindings: KeyBindings;
  onKeyBindingsChange: (bindings: KeyBindings) => void | Promise<void>;
  shiftEnterNewline: boolean;
  onShiftEnterNewlineChange: (enabled: boolean) => void | Promise<void>;
  notification: NotificationConfig;
  notificationPermission: NotificationPermissionState;
  onNotificationChange: (patch: Partial<NotificationConfig>) => void | Promise<void>;
  state: StateConfig;
  onStateChange: (patch: Partial<StateConfig>) => void | Promise<void>;
  onNotificationPermissionRefresh: () => Promise<NotificationPermissionState>;
  onNotificationPermissionRequest: () => Promise<NotificationPermissionState>;
  onClose: () => void;
};

export function SettingsModal({
  open,
  colorScheme,
  onColorSchemeChange,
  shell,
  onShellChange,
  restoreEnabled,
  onRestoreEnabledChange,
  keyBindings,
  onKeyBindingsChange,
  shiftEnterNewline,
  onShiftEnterNewlineChange,
  notification,
  notificationPermission,
  onNotificationChange,
  state,
  onStateChange,
  onNotificationPermissionRefresh,
  onNotificationPermissionRequest,
  onClose,
}: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [category, setCategory] = useState<CategoryId>('appearance');
  if (!open && category !== 'appearance') {
    setCategory('appearance');
  }

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selected = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  return (
    <div className="settings-backdrop" onMouseDown={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="設定"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <nav className="settings-nav">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`settings-nav-item${category === c.id ? ' active' : ''}`}
              type="button"
              aria-current={category === c.id ? 'page' : undefined}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </nav>
        <div className="settings-pane">
          <header className="settings-pane-header">
            <h2>{selected.label}</h2>
          </header>
          {category === 'appearance' ? (
            <AppearanceSettings colorScheme={colorScheme} onColorSchemeChange={onColorSchemeChange} />
          ) : category === 'general' ? (
            <GeneralSettings
              shell={shell}
              onShellChange={onShellChange}
              restoreEnabled={restoreEnabled}
              onRestoreEnabledChange={onRestoreEnabledChange}
            />
          ) : category === 'notifications' ? (
            <NotificationsSettings
              notification={notification}
              state={state}
              permissionState={notificationPermission}
              onNotificationChange={onNotificationChange}
              onStateChange={onStateChange}
              onPermissionRefresh={onNotificationPermissionRefresh}
              onPermissionRequest={onNotificationPermissionRequest}
            />
          ) : (
            <KeyboardSettings
              bindings={keyBindings}
              onBindingsChange={onKeyBindingsChange}
              shiftEnterNewline={shiftEnterNewline}
              onShiftEnterNewlineChange={onShiftEnterNewlineChange}
            />
          )}
          <footer className="settings-footer">
            <button ref={closeButtonRef} className="settings-close" type="button" onClick={onClose}>
              キャンセル
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
