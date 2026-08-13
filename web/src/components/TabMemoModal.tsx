import { useEffect, useRef, useState } from 'react';
import { MAX_MEMO_CODE_POINTS, clampUnicode, unicodeLength } from '../util';

type Props = {
  open: boolean;
  initialMemo: string;
  onSave: (memo: string) => Promise<void>;
  onClose: () => void;
};

export function TabMemoModal({ open, initialMemo, onSave, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialMemo);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(initialMemo);
    setSaving(false);
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    queueMicrotask(() => inputRef.current?.focus());
    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, initialMemo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!saving) onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, saving]);

  if (!open) return null;

  const remaining = MAX_MEMO_CODE_POINTS - unicodeLength(value);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(value.trim());
    } catch {
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <div className="memo-backdrop" onMouseDown={() => { if (!saving) onClose(); }}>
      <div
        className="memo-modal"
        role="dialog"
        aria-modal="true"
        aria-label="タブメモ"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="memo-modal-header">
          <h2>タブメモ</h2>
          <span className="memo-remaining" aria-live="polite">
            残り {remaining}
          </span>
        </header>
        <input
          ref={inputRef}
          className="memo-input"
          type="text"
          value={value}
          placeholder="用途を短くメモ（任意）"
          disabled={saving}
          onChange={(e) => setValue(clampUnicode(e.target.value))}
          onKeyDown={(e) => {
            // Ignore Enter used to confirm IME composition (Japanese etc.).
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <footer className="memo-modal-footer">
          <button type="button" className="memo-cancel" disabled={saving} onClick={onClose}>
            キャンセル
          </button>
          <button type="button" className="memo-save" disabled={saving} onClick={() => void submit()}>
            保存
          </button>
        </footer>
      </div>
    </div>
  );
}
