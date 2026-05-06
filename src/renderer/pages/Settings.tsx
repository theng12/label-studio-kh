import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useThemeStore, type ThemeMode } from '../stores/themeStore';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';

type AppSettings = Awaited<ReturnType<typeof window.api.settings.get>>;

export default function Settings() {
  const { t, i18n } = useTranslation();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const [s, setS] = useState<AppSettings | null>(null);

  useEffect(() => {
    void window.api.settings.get().then(setS);
  }, []);

  const update = async (patch: Partial<AppSettings>) => {
    const next = (await window.api.settings.set(patch)) as AppSettings;
    setS(next);
  };

  const onPickFolder = async () => {
    const folder = await window.api.export.pickFolder(s?.defaultSaveLocation);
    if (folder) await update({ defaultSaveLocation: folder });
  };

  return (
    <Page title={t('settings.title')}>
      <Row label={t('settings.theme')} description={t('settings.themeDescription')}>
        <ThemeSwitcher value={mode} onChange={setMode} />
      </Row>

      <Row label={t('settings.language')} description={t('settings.languageDescription')}>
        <select
          value={i18n.language}
          onChange={(e) => {
            setLanguage(e.target.value);
            void update({ uiLanguage: e.target.value });
          }}
          className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </Row>

      <Row
        label={t('settings.saveLocation')}
        description={t('settings.saveLocationDescription')}
      >
        <div className="flex items-center gap-2">
          <code className="max-w-xs truncate rounded bg-bg-elevated px-2 py-1 text-xs text-fg-muted">
            {s?.defaultSaveLocation ?? '—'}
          </code>
          <Button size="sm" variant="secondary" onClick={onPickFolder}>
            Change…
          </Button>
        </div>
      </Row>

      <Row
        label="Default file naming"
        description="Tokens: {SKU} {Brand} {Size} {Date} {Name} {Index}"
      >
        <input
          value={s?.defaultNamingPattern ?? ''}
          onChange={(e) => void update({ defaultNamingPattern: e.target.value })}
          className="w-72 rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono"
        />
      </Row>

      <Row label="Default DPI" description="150 / 300 / 600">
        <select
          value={s?.defaultDpi ?? 300}
          onChange={(e) => void update({ defaultDpi: parseInt(e.target.value, 10) as 150 | 300 | 600 })}
          className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value={150}>150</option>
          <option value={300}>300</option>
          <option value={600}>600</option>
        </select>
      </Row>

      <Row
        label="Time saved estimate"
        description="Used for the dashboard 'time saved' stat (minutes per label)."
      >
        <input
          type="number"
          min={0}
          step={0.5}
          value={s?.timeSavedMinutesPerLabel ?? 4}
          onChange={(e) =>
            void update({
              timeSavedMinutesPerLabel: parseFloat(e.target.value) || 0,
            })
          }
          className="w-24 rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        />
      </Row>

      <Row
        label="Hide demo brand"
        description="Hides the seeded Demo brand from the brand list."
      >
        <input
          type="checkbox"
          checked={s?.hideDemoBrand ?? false}
          onChange={(e) => void update({ hideDemoBrand: e.target.checked })}
        />
      </Row>
    </Page>
  );
}

function Row({
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
