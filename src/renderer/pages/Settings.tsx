import { Page } from '../components/Page';
import { useThemeStore, type ThemeMode } from '../stores/themeStore';

export default function Settings() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <Page title="Settings">
      <SettingRow
        label="Theme"
        description="Light, Dark, or follow your operating system."
      >
        <ThemeSwitcher value={mode} onChange={setMode} />
      </SettingRow>

      <SettingRow
        label="Default save location"
        description="Where generated label files are saved by default. Configurable in Phase 2."
      >
        <code className="rounded bg-bg-elevated px-2 py-1 text-xs text-fg-muted">
          ~/Documents/Label Studio KH/exports
        </code>
      </SettingRow>
    </Page>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-4">
      <div>
        <div className="text-sm font-medium text-fg-base">{label}</div>
        <div className="mt-0.5 text-xs text-fg-muted">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ThemeSwitcher({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (m: ThemeMode) => void;
}) {
  const opts: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];
  return (
    <div className="flex rounded-md border border-border-base bg-bg-surface p-0.5">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={[
            'px-3 py-1 text-xs font-medium rounded-sm transition-colors',
            value === o.value
              ? 'bg-accent text-accent-fg'
              : 'text-fg-muted hover:text-fg-base',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
