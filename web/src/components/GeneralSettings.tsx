import { useEffect, useRef, useState } from 'react';

type Props = {
  shell: string;
  onShellChange: (shell: string) => void | Promise<void>;
  restoreEnabled: boolean;
  onRestoreEnabledChange: (enabled: boolean) => void | Promise<void>;
};

export function GeneralSettings({ shell, onShellChange, restoreEnabled, onRestoreEnabledChange }: Props) {
  const [value, setValue] = useState(shell);
  const persistedRef = useRef(shell);
  const inFlightRef = useRef(false);

  const [restore, setRestore] = useState(restoreEnabled);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const restoreInFlightRef = useRef(false);

  useEffect(() => {
    setValue(shell);
    persistedRef.current = shell;
  }, [shell]);

  useEffect(() => {
    setRestore(restoreEnabled);
  }, [restoreEnabled]);

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

  const commitRestore = async (next: boolean) => {
    if (restoreInFlightRef.current) return;
    restoreInFlightRef.current = true;
    setRestore(next);
    setRestoreError(null);
    try {
      await onRestoreEnabledChange(next);
    } catch (err) {
      setRestore(!next);
      setRestoreError(err instanceof Error ? err.message : String(err));
    } finally {
      restoreInFlightRef.current = false;
    }
  };

  return (
    <>
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
          zsh / bash ではサイドバーのカレントディレクトリとコマンドがライブ更新されます。新しいタブから適用されます
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-heading">セッションの復元</h3>
        <label className={`settings-option ${restore ? 'selected' : ''}`}>
          <input
            type="checkbox"
            checked={restore}
            aria-label="エージェントセッションを復元"
            onChange={(e) => void commitRestore(e.target.checked)}
          />
          <span className="settings-option-label">エージェントセッションを復元する</span>
          <span className="settings-option-hint">
            復元したタブでは resume コマンド（claude --continue など）が自動実行されます
          </span>
        </label>

        {restoreError && (
          <p className="settings-field-error" role="alert">
            {restoreError}
          </p>
        )}

        <p className="settings-field-hint">
          デーモンの停止時に開いていたエージェントのタブを、次回の起動でカレントディレクトリとメモごと開き直します。エージェントごとの
          resume コマンドの変更は config.json の restore.commands で行います
        </p>
      </section>
    </>
  );
}
