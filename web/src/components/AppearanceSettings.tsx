import type { ColorScheme } from '../types';

const OPTIONS: { value: ColorScheme; label: string; hint: string }[] = [
  { value: 'light', label: 'ライト', hint: '常に明るいテーマ' },
  { value: 'dark', label: 'ダーク', hint: '常に暗いテーマ' },
  { value: 'system', label: '自動', hint: 'OS の設定に合わせる' },
];

type Props = {
  colorScheme: ColorScheme;
  onColorSchemeChange: (scheme: ColorScheme) => void;
};

export function AppearanceSettings({ colorScheme, onColorSchemeChange }: Props) {
  return (
    <section className="settings-section">
      <h3 className="settings-heading">テーマ</h3>
      <div className="settings-options" role="radiogroup" aria-label="テーマ">
        {OPTIONS.map((opt) => (
          <label key={opt.value} className={`settings-option ${colorScheme === opt.value ? 'selected' : ''}`}>
            <input
              type="radio"
              name="color-scheme"
              value={opt.value}
              checked={colorScheme === opt.value}
              onChange={() => onColorSchemeChange(opt.value)}
            />
            <span className="settings-option-label">{opt.label}</span>
            <span className="settings-option-hint">{opt.hint}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
