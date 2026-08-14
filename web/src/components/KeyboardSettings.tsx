import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_KEY_BINDINGS,
  formatBinding,
  normalizeKeyEvent,
  validateBindings,
  type BindingIssue,
  type KeyBindings,
} from '../keymap';

type Slot = 'prefix' | 'next_tab' | 'prev_tab';

type Props = {
  bindings: KeyBindings;
  onBindingsChange: (bindings: KeyBindings) => void | Promise<void>;
};

const ISSUE_MESSAGE: Record<BindingIssue, string> = {
  prefix_no_modifier: 'プレフィックスキーには修飾キー（Ctrl / Alt / Shift / Cmd）が必要です',
  next_prev_equal: '次タブと前タブに同じキーは使えません',
  escape: 'Escape は割り当てできません',
  unparsable: 'このキーは割り当てできません',
  reserved: '既存のショートカット（Cmd+1〜9 / Cmd+N / Cmd+C / Cmd+V）と衝突しています',
};

function sameBindings(a: KeyBindings, b: KeyBindings): boolean {
  return a.enabled === b.enabled
    && a.prefix === b.prefix
    && a.next_tab === b.next_tab
    && a.prev_tab === b.prev_tab;
}

export function KeyboardSettings({ bindings: persisted, onBindingsChange }: Props) {
  const [bindings, setBindings] = useState(persisted);
  const [recording, setRecording] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const persistedRef = useRef(persisted);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setBindings(persisted);
    persistedRef.current = persisted;
  }, [persisted]);

  const commit = useCallback(async (next: KeyBindings) => {
    const issue = validateBindings(next);
    if (issue) {
      setError(ISSUE_MESSAGE[issue]);
      setBindings(persistedRef.current);
      return;
    }
    if (sameBindings(next, persistedRef.current)) {
      setError(null);
      setBindings(persistedRef.current);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBindings(next);
    setError(null);
    try {
      await onBindingsChange(next);
      persistedRef.current = next;
    } catch (err) {
      setBindings(persistedRef.current);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      inFlightRef.current = false;
    }
  }, [onBindingsChange]);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecording(null);
        return;
      }
      const spec = normalizeKeyEvent(e);
      if (!spec) return;
      const slot = recording;
      setRecording(null);
      void commit({ ...persistedRef.current, [slot]: spec });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, commit]);

  const label = (slot: Slot) => {
    if (recording === slot) return 'キーを入力…';
    return formatBinding(bindings[slot]);
  };

  return (
    <section className="settings-section">
      <h3 className="settings-heading">タブ移動</h3>
      <label className={`settings-option ${bindings.enabled ? 'selected' : ''}`}>
        <input
          type="checkbox"
          checked={bindings.enabled}
          aria-label="タブ移動ショートカット"
          onChange={(e) => void commit({ ...bindings, enabled: e.target.checked })}
        />
        <span className="settings-option-label">ショートカットを有効にする</span>
        <span className="settings-option-hint">プレフィックスのあと n / p で隣のタブへ</span>
      </label>

      <div className="settings-bindings">
        <div className="settings-binding-row">
          <span>プレフィックス</span>
          <button
            type="button"
            className={`settings-binding${recording === 'prefix' ? ' recording' : ''}`}
            aria-label="プレフィックスキー"
            onClick={() => { setError(null); setRecording('prefix'); }}
          >
            {label('prefix')}
          </button>
        </div>
        <div className="settings-binding-row">
          <span>次のタブ</span>
          <button
            type="button"
            className={`settings-binding${recording === 'next_tab' ? ' recording' : ''}`}
            aria-label="次のタブ"
            onClick={() => { setError(null); setRecording('next_tab'); }}
          >
            {label('next_tab')}
          </button>
        </div>
        <div className="settings-binding-row">
          <span>前のタブ</span>
          <button
            type="button"
            className={`settings-binding${recording === 'prev_tab' ? ' recording' : ''}`}
            aria-label="前のタブ"
            onClick={() => { setError(null); setRecording('prev_tab'); }}
          >
            {label('prev_tab')}
          </button>
        </div>
      </div>

      {error && (
        <p className="settings-field-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="settings-reset"
        aria-label="キー割り当てをリセット"
        onClick={() => void commit({ ...DEFAULT_KEY_BINDINGS, enabled: bindings.enabled })}
      >
        キー割り当てをリセット
      </button>
    </section>
  );
}
