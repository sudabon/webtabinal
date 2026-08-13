import { useEffect } from 'react';
import type { ColorScheme } from '../types';
import { AppearanceSettings } from './AppearanceSettings';

const CATEGORIES = [{ id: 'appearance', label: '外観' }] as const;

type Props = {
  open: boolean;
  colorScheme: ColorScheme;
  onColorSchemeChange: (scheme: ColorScheme) => void;
  onClose: () => void;
};

export function SettingsModal({ open, colorScheme, onColorSchemeChange, onClose }: Props) {
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
            <button key={c.id} className="settings-nav-item active" type="button">
              {c.label}
            </button>
          ))}
        </nav>
        <div className="settings-pane">
          <header className="settings-pane-header">
            <h2>外観</h2>
          </header>
          <AppearanceSettings colorScheme={colorScheme} onColorSchemeChange={onColorSchemeChange} />
          <footer className="settings-footer">
            <button className="settings-close" type="button" onClick={onClose}>
              キャンセル
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
