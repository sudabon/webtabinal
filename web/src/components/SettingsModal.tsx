import { useEffect, useRef, useState } from 'react';
import type { ColorScheme, KeyBindings } from '../types';
import { AppearanceSettings } from './AppearanceSettings';
import { GeneralSettings } from './GeneralSettings';
import { KeyboardSettings } from './KeyboardSettings';

const CATEGORIES = [
  { id: 'appearance', label: '外観' },
  { id: 'general', label: '一般' },
  { id: 'keyboard', label: 'キーボード' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

type Props = {
  open: boolean;
  colorScheme: ColorScheme;
  onColorSchemeChange: (scheme: ColorScheme) => void;
  shell: string;
  onShellChange: (shell: string) => void | Promise<void>;
  keyBindings: KeyBindings;
  onKeyBindingsChange: (bindings: KeyBindings) => void | Promise<void>;
  onClose: () => void;
};

export function SettingsModal({
  open,
  colorScheme,
  onColorSchemeChange,
  shell,
  onShellChange,
  keyBindings,
  onKeyBindingsChange,
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
            <GeneralSettings shell={shell} onShellChange={onShellChange} />
          ) : (
            <KeyboardSettings bindings={keyBindings} onBindingsChange={onKeyBindingsChange} />
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
