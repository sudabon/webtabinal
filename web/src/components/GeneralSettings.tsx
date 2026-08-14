import { useEffect, useRef, useState } from 'react';

type Props = {
  shell: string;
  onShellChange: (shell: string) => void | Promise<void>;
};

export function GeneralSettings({ shell, onShellChange }: Props) {
  const [value, setValue] = useState(shell);
  const persistedRef = useRef(shell);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setValue(shell);
    persistedRef.current = shell;
  }, [shell]);

  const commit = async () => {
    const next = value.trim();
    if (next === persistedRef.current) return;
    if (!next) {
      setValue(persistedRef.current);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await onShellChange(next);
      persistedRef.current = next;
    } catch {
      setValue(persistedRef.current);
    } finally {
      inFlightRef.current = false;
    }
  };

  return (
    <section className="settings-section">
      <h3 className="settings-heading">起動シェル</h3>
      <input
        className="settings-input"
        type="text"
        value={value}
        placeholder="/bin/zsh または /bin/bash"
        aria-label="起動シェル"
        aria-describedby="settings-shell-hint"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          }
        }}
      />
      <p id="settings-shell-hint" className="settings-field-hint">
        新しいタブから適用されます
      </p>
    </section>
  );
}
