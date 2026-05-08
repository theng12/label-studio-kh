import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useThemeStore, type ThemeMode } from '../stores/themeStore';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';
import { FilenamePatternInput } from '../components/FilenamePatternInput';

type AppSettings = Awaited<ReturnType<typeof window.api.settings.get>>;
type AppInfo = Awaited<ReturnType<typeof window.api.app.getInfo>>;
type FontStatus = Awaited<ReturnType<typeof window.api.app.getFontStatus>>;

export default function Settings() {
  const { t, i18n } = useTranslation();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const [s, setS] = useState<AppSettings | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [fontStatus, setFontStatus] = useState<FontStatus | null>(null);

  useEffect(() => {
    void window.api.settings.get().then(setS);
    void window.api.app.getInfo().then(setInfo);
    void window.api.app.getFontStatus().then(setFontStatus);
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

      <FontStatusRow status={fontStatus} />

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
        description="Picked when the Generate page loads. Pick a preset or type your own."
      >
        <div className="w-80">
          <FilenamePatternInput
            value={s?.defaultNamingPattern ?? ''}
            onChange={(v) => void update({ defaultNamingPattern: v })}
          />
        </div>
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

      <About info={info} />
    </Page>
  );
}

function About({ info }: { info: AppInfo | null }) {
  return (
    <div className="mt-8 rounded-lg border border-border-base bg-bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-fg-subtle">
        About
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-base font-semibold text-fg-base">
            Label Studio KH
          </div>
          <div className="text-xs text-fg-muted">
            Desktop label design and bulk generation
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono text-fg-base">
            v{info?.version ?? '—'}
          </div>
          {info?.isDev && (
            <div className="mt-0.5 inline-block rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              development build
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-border-subtle pt-3 text-xs">
        <DetailRow label="Platform" value={info?.platform ?? '—'} />
        <DetailRow label="Electron" value={info?.electronVersion ?? '—'} />
        <DetailRow label="Chromium" value={info?.chromeVersion ?? '—'} />
        <DetailRow label="Node" value={info?.nodeVersion ?? '—'} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
        <div className="text-xs text-fg-muted">
          Update checking will land in a future release.
        </div>
        <Button size="sm" variant="secondary" disabled title="Available in a future release">
          Check for updates
        </Button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-fg-subtle">{label}</span>
      <span className="font-mono text-fg-base">{value}</span>
    </div>
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

function FontStatusRow({ status }: { status: FontStatus | null }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const loaded = status?.loaded.length ?? 0;
  const total = status?.total ?? 0;
  const missing = status?.missing ?? [];
  const allLoaded = status !== null && missing.length === 0;
  const downloadCmd = 'node scripts/download-fonts.mjs';

  return (
    <div className="border-b border-border-subtle py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-fg-base">
            {t('settings.fonts')}
          </div>
          <div className="mt-0.5 text-xs text-fg-muted">
            {t('settings.fontsDescription')}
          </div>
        </div>
        <button
          type="button"
          onClick={() => missing.length > 0 && setExpanded((v) => !v)}
          disabled={missing.length === 0}
          title={
            missing.length > 0
              ? t('settings.fontsMissingTooltip', { files: missing.join(', ') })
              : undefined
          }
          className={[
            'inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium',
            missing.length > 0 ? 'cursor-pointer hover:bg-bg-elevated' : 'cursor-default',
            allLoaded
              ? 'text-success'
              : status === null
                ? 'text-fg-muted'
                : 'text-warning',
          ].join(' ')}
        >
          {allLoaded ? (
            <IconCheck size={16} stroke={2.5} />
          ) : status === null ? null : (
            <IconAlertTriangle size={16} stroke={2.5} />
          )}
          <span>
            {status === null
              ? t('settings.fontsLoading')
              : t('settings.fontsLoaded', { loaded, total })}
          </span>
        </button>
      </div>

      {status !== null && !allLoaded && (
        <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs">
          <div className="text-fg-base">
            {t('settings.fontsMissingNudge')}{' '}
            <code className="rounded bg-bg-elevated px-1 py-0.5 font-mono">
              {downloadCmd}
            </code>
          </div>
          {expanded && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 font-mono text-fg-muted">
              {missing.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
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
