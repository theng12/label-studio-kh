import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconWand,
  IconFolder,
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconCheck,
  IconX,
  IconAlertCircle,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useBrandStore } from '../stores/brandStore';
import { useSettingsStore } from '../stores/settingsStore';
import { ElementView } from '../designer/ElementView';
import { FilenamePatternInput } from '../components/FilenamePatternInput';
import type { Template } from '../../shared/types/template';
import type {
  ExportFormat,
  ExportSettings,
  ExportProgressInfo,
  BulkExportSummary,
} from '../../preload/index';

type SkuRow = Awaited<ReturnType<typeof window.api.import.listSkus>>[number];

const DEFAULT_FILENAME_PATTERN = '{SKU}_{Size}';

export default function Generate() {
  const navigate = useNavigate();
  const { brands, refresh } = useBrandStore();
  const appSettings = useSettingsStore((s) => s.settings);
  const refreshSettings = useSettingsStore((s) => s.refresh);
  const [brandId, setBrandId] = useState<string>('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);

  const [formats, setFormats] = useState<ExportFormat[]>(['pdf']);
  const [dpi, setDpi] = useState<150 | 300 | 600>(300);
  const [filenamePattern, setFilenamePattern] = useState(DEFAULT_FILENAME_PATTERN);
  const [outputDir, setOutputDir] = useState<string>('');
  const [folderOrg, setFolderOrg] = useState<ExportSettings['folderOrganization']>('none');
  const [overwrite, setOverwrite] = useState(true);

  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExportProgressInfo | null>(null);
  const [summary, setSummary] = useState<BulkExportSummary | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    void refresh();
    void refreshSettings();
  }, [refresh, refreshSettings]);

  // Seed defaults from saved settings the first time they arrive. We only
  // overwrite blank/default fields so a user mid-edit isn't clobbered.
  useEffect(() => {
    if (!appSettings) return;
    setOutputDir((curr) => curr || appSettings.defaultSaveLocation);
    setFilenamePattern((curr) =>
      curr === DEFAULT_FILENAME_PATTERN ? appSettings.defaultNamingPattern : curr,
    );
    setDpi((curr) => (curr === 300 ? appSettings.defaultDpi : curr));
    setFormats((curr) => {
      if (curr.length !== 1 || curr[0] !== 'pdf') return curr;
      switch (appSettings.defaultExportFormat) {
        case 'all':
          return ['pdf', 'png', 'jpeg'];
        case 'pdf':
        case 'png':
        case 'jpeg':
          return [appSettings.defaultExportFormat];
        default:
          return curr;
      }
    });
  }, [appSettings]);

  useEffect(() => {
    if (!brandId && brands.length > 0) setBrandId(brands[0]!.id);
  }, [brands, brandId]);

  useEffect(() => {
    if (!brandId) return;
    void Promise.all([
      window.api.template.listForBrand(brandId).then(setTemplates),
      window.api.import.listSkus(brandId).then((s) => {
        setSkus(s);
        setPreviewIdx(0);
      }),
    ]);
  }, [brandId]);

  useEffect(() => {
    if (templates.length > 0 && !templateId) setTemplateId(templates[0]!.id);
  }, [templates, templateId]);

  const template = templates.find((t) => t.id === templateId) ?? null;
  const brand = brands.find((b) => b.id === brandId) ?? null;
  const previewRow = skus[previewIdx]
    ? skuToRow(skus[previewIdx]!)
    : { sku: 'DEMO-001', product_name: 'Sample Product', barcode: '8851234567890' };

  const canGenerate = !!template && !!brand && skus.length > 0 && formats.length > 0 && !!outputDir;

  const settings: ExportSettings = useMemo(
    () => ({
      formats,
      dpi,
      outputDir,
      filenamePattern,
      folderOrganization: folderOrg,
      overwrite,
    }),
    [formats, dpi, outputDir, filenamePattern, folderOrg, overwrite],
  );

  const onPickFolder = async () => {
    const folder = await window.api.export.pickFolder(outputDir || undefined);
    if (folder) setOutputDir(folder);
  };

  const onPreviewFullSize = async () => {
    if (!template || !brand) return;
    const r = await window.api.export.single({
      template,
      brand,
      row: previewRow,
      index: 0,
      total: 1,
      settings: { ...settings, formats: ['pdf'], outputDir: outputDir || (await tempDir()) },
    });
    const file = r.files[0];
    if (file) await window.api.export.openInOS(file);
  };

  const onGenerate = async () => {
    if (!template || !brand || skus.length === 0) return;
    const id = crypto.randomUUID();
    setRunId(id);
    setRunning(true);
    setProgress(null);
    setSummary(null);
    startTimeRef.current = Date.now();

    const off = window.api.export.onProgress(id, (info) => setProgress(info));

    try {
      const rows = skus.map(skuToRow);
      const result = await window.api.export.bulk({
        runId: id,
        template,
        brand,
        rows,
        settings,
      });
      setSummary(result);
    } finally {
      off();
      setRunning(false);
    }
  };

  const onCancel = async () => {
    if (runId) await window.api.export.cancel(runId);
  };

  if (brands.length === 0) {
    return (
      <Page title="Generate">
        <Empty msg="Create a brand first on the Brands page." />
      </Page>
    );
  }

  return (
    <Page title="Generate">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Section title="Source">
            <Field label="Brand">
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Template">
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={templates.length === 0}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              >
                {templates.length === 0 && <option>No templates for this brand</option>}
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.width_mm}×{t.height_mm}mm
                  </option>
                ))}
              </select>
            </Field>

            <div className="text-xs text-fg-muted">
              <strong className="text-fg-base">{skus.length}</strong> SKU{skus.length === 1 ? '' : 's'}{' '}
              for this brand. Imported via Data & Import.
            </div>
          </Section>

          <Section title="Output">
            <Field label="Format">
              <div className="flex gap-2">
                {(['pdf', 'png', 'jpeg'] as ExportFormat[]).map((f) => (
                  <label key={f} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={formats.includes(f)}
                      onChange={(e) =>
                        setFormats(
                          e.target.checked ? [...formats, f] : formats.filter((x) => x !== f),
                        )
                      }
                    />
                    {f.toUpperCase()}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="DPI">
              <div className="flex gap-1 rounded-md border border-border-base bg-bg-surface p-0.5">
                {[150, 300, 600].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDpi(d as 150 | 300 | 600)}
                    className={[
                      'flex-1 px-3 py-1 text-xs rounded',
                      dpi === d ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-fg-base',
                    ].join(' ')}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Filename pattern" hint="Pick a preset or type your own">
              <FilenamePatternInput
                value={filenamePattern}
                onChange={setFilenamePattern}
              />
              <div className="mt-1 text-[10px] text-fg-subtle">
                Example for first row:{' '}
                <code className="rounded bg-bg-elevated px-1 py-px">
                  {samplePreview(filenamePattern, previewRow, brand?.name ?? '', template)}
                </code>
              </div>
            </Field>

            <Field label="Save location">
              <div className="flex gap-2">
                <input
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  placeholder="(no folder selected)"
                  className="flex-1 rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                />
                <Button onClick={onPickFolder} size="sm">
                  <IconFolder size={14} /> Browse
                </Button>
              </div>
            </Field>

            <Field label="Folder organization">
              <select
                value={folderOrg}
                onChange={(e) => setFolderOrg(e.target.value as typeof folderOrg)}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              >
                <option value="none">All in one folder</option>
                <option value="brand">By brand</option>
                <option value="brand_size">By brand + size</option>
                <option value="brand_template">By brand + template</option>
              </select>
            </Field>

            <label className="flex items-center gap-2 text-xs text-fg-base">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              Overwrite existing files with the same name
            </label>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Preview">
            {template ? (
              <>
                <PreviewCanvas template={template} row={previewRow} brand={brand} />
                <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={previewIdx === 0 || skus.length === 0}
                    onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))}
                  >
                    <IconChevronLeft size={14} /> Prev
                  </Button>
                  <span>
                    {skus.length === 0
                      ? 'No data — showing demo row'
                      : `${previewIdx + 1} of ${skus.length}`}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={previewIdx >= skus.length - 1 || skus.length === 0}
                    onClick={() => setPreviewIdx(Math.min(skus.length - 1, previewIdx + 1))}
                  >
                    Next <IconChevronRight size={14} />
                  </Button>
                </div>
                <div className="mt-2">
                  <Button size="sm" variant="secondary" onClick={onPreviewFullSize} disabled={!brand || !template}>
                    <IconExternalLink size={14} /> Preview as PDF
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-fg-muted">Select a template to preview.</div>
            )}
          </Section>

          {!canGenerate && (
            <PrereqChecklist
              brand={brand}
              brandHasTemplates={templates.length > 0}
              templateSelected={!!template}
              skuCount={skus.length}
              formatsCount={formats.length}
              outputDirSet={!!outputDir}
              onGoToBrands={() => navigate('/brands')}
              onGoToTemplates={() => navigate('/templates')}
              onGoToImport={() => navigate('/data')}
              onPickFolder={onPickFolder}
            />
          )}

          <Button
            variant="primary"
            disabled={!canGenerate || running}
            onClick={onGenerate}
            className="w-full"
            title={canGenerate ? '' : 'Some things still need to be set — see the checklist above.'}
          >
            <IconWand size={14} /> Generate {skus.length} label{skus.length === 1 ? '' : 's'}{' '}
            ({formats.map((f) => f.toUpperCase()).join('+') || '—'})
          </Button>
        </div>
      </div>

      {(running || summary) && (
        <ProgressOverlay
          running={running}
          progress={progress}
          summary={summary}
          startTime={startTimeRef.current}
          onCancel={onCancel}
          onClose={() => {
            setSummary(null);
            setProgress(null);
            setRunId(null);
          }}
          outputDir={outputDir}
        />
      )}
    </Page>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function skuToRow(s: SkuRow): Record<string, string> {
  const base: Record<string, string> = {
    sku: s.sku,
    product_name: s.product_name ?? '',
    barcode: s.barcode ?? '',
    description: s.description ?? '',
    variant: s.variant ?? '',
    unit_qty: s.unit_qty ?? '',
    unit_word: s.unit_word ?? '',
    product_url: s.product_url ?? '',
    product_image_path: s.product_image_path ?? '',
    date: s.date ?? '',
    notes: s.notes ?? '',
  };
  if (s.extra_json) {
    try {
      const extra = JSON.parse(s.extra_json) as Record<string, string>;
      Object.assign(base, extra);
    } catch {
      // ignore malformed extras
    }
  }
  return base;
}

function samplePreview(
  pattern: string,
  row: Record<string, string>,
  brandName: string,
  template: Template | null,
): string {
  if (!template) return '—';
  const sizeLabel = `${template.width_mm}x${template.height_mm}mm`;
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return pattern
    .replace(/\{SKU\}/g, row.sku ?? '')
    .replace(/\{Brand\}/g, brandName.replace(/\s+/g, '_'))
    .replace(/\{Size\}/g, sizeLabel)
    .replace(/\{Date\}/g, dateStr)
    .replace(/\{Name\}/g, (row.product_name ?? '').slice(0, 40).replace(/\s+/g, '_'))
    .replace(/\{Index\}/g, '0001');
}

async function tempDir(): Promise<string> {
  return '/tmp/lskh-preview';
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-base bg-bg-surface p-4">
      <div className="mb-3 text-sm font-semibold text-fg-base">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-fg-muted">{label}</div>
      <div className="mt-1">{children}</div>
      {hint && <div className="mt-1 text-[10px] text-fg-subtle">{hint}</div>}
    </label>
  );
}

// ── Prerequisites checklist (replaces silent disabled state) ────────────────

function PrereqChecklist({
  brand,
  brandHasTemplates,
  templateSelected,
  skuCount,
  formatsCount,
  outputDirSet,
  onGoToBrands,
  onGoToTemplates,
  onGoToImport,
  onPickFolder,
}: {
  brand: import('../../shared/types/brand').Brand | null;
  brandHasTemplates: boolean;
  templateSelected: boolean;
  skuCount: number;
  formatsCount: number;
  outputDirSet: boolean;
  onGoToBrands: () => void;
  onGoToTemplates: () => void;
  onGoToImport: () => void;
  onPickFolder: () => void;
}) {
  const items: Array<{
    ok: boolean;
    label: string;
    fix?: { label: string; onClick: () => void };
  }> = [
    {
      ok: !!brand,
      label: brand ? `Brand: ${brand.name}` : 'No brand selected',
      fix: !brand ? { label: 'Pick or create a brand', onClick: onGoToBrands } : undefined,
    },
    {
      ok: brandHasTemplates && templateSelected,
      label: brandHasTemplates
        ? templateSelected
          ? 'Template selected'
          : 'Pick a template above'
        : `${brand?.name ?? 'This brand'} has no templates yet`,
      fix: !brandHasTemplates
        ? { label: 'Create a template', onClick: onGoToTemplates }
        : undefined,
    },
    {
      ok: skuCount > 0,
      label:
        skuCount > 0
          ? `${skuCount.toLocaleString()} SKU${skuCount === 1 ? '' : 's'} ready`
          : `${brand?.name ?? 'This brand'} has no SKUs yet`,
      fix: skuCount === 0
        ? { label: 'Import or add SKUs', onClick: onGoToImport }
        : undefined,
    },
    {
      ok: formatsCount > 0,
      label:
        formatsCount > 0
          ? `${formatsCount} output format${formatsCount === 1 ? '' : 's'} chosen`
          : 'No output format selected',
    },
    {
      ok: outputDirSet,
      label: outputDirSet ? 'Save location set' : 'No save location chosen',
      fix: !outputDirSet
        ? { label: 'Pick a folder', onClick: onPickFolder }
        : undefined,
    },
  ];

  const blockers = items.filter((i) => !i.ok);
  if (blockers.length === 0) return null;

  return (
    <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2 font-medium text-warning">
        <IconAlertCircle size={14} />
        {blockers.length === 1
          ? "One thing still missing before we can generate"
          : `${blockers.length} things still missing before we can generate`}
      </div>
      <ul className="space-y-1.5">
        {items.map((i, idx) => (
          <li
            key={idx}
            className={[
              'flex items-center gap-2 text-xs',
              i.ok ? 'text-fg-muted' : 'text-fg-base',
            ].join(' ')}
          >
            {i.ok ? (
              <IconCheck size={12} className="shrink-0 text-success" />
            ) : (
              <IconX size={12} className="shrink-0 text-danger" />
            )}
            <span className="flex-1">{i.label}</span>
            {!i.ok && i.fix && (
              <button
                onClick={i.fix.onClick}
                className="rounded border border-border-base bg-bg-elevated px-2 py-0.5 text-[10px] font-medium text-fg-base hover:bg-bg-hover"
              >
                {i.fix.label} →
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border-base p-12 text-center text-sm text-fg-muted">
      {msg}
    </div>
  );
}

const PX_PER_MM = 4;

function PreviewCanvas({
  template,
  row,
  brand,
}: {
  template: Template;
  row: Record<string, string>;
  brand: import('../../shared/types/brand').Brand | null;
}) {
  // Light-weight HTML/CSS preview (same as designer). Real output uses Puppeteer.
  return (
    <div className="rounded-md border border-border-subtle bg-white p-4">
      <div className="flex items-center justify-center">
        <div
          className="relative shadow-sm"
          style={{
            width: template.width_mm * PX_PER_MM,
            height: template.height_mm * PX_PER_MM,
            background: template.background,
            outline: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          {[...template.elements]
            .sort((a, b) => a.zIndex - b.zIndex)
            .filter((e) => e.visible)
            .map((el) => (
              <div
                key={el.id}
                style={{
                  position: 'absolute',
                  left: el.x_mm * PX_PER_MM,
                  top: el.y_mm * PX_PER_MM,
                  width: el.width_mm * PX_PER_MM,
                  height: el.height_mm * PX_PER_MM,
                  zIndex: el.zIndex,
                  overflow: 'hidden',
                }}
              >
                <ElementView
                  element={resolveElement(el, row)}
                  brand={brand}
                  pxPerMm={PX_PER_MM}
                />
              </div>
            ))}
        </div>
      </div>
      <div className="mt-2 text-center text-[10px] text-fg-subtle">
        {template.width_mm}×{template.height_mm}mm preview (HTML — final output is rendered by Puppeteer)
      </div>
    </div>
  );
}

import type { TemplateElement, TextElement } from '../../shared/types/template';

function resolveElement(el: TemplateElement, row: Record<string, string>): TemplateElement {
  if ((el.type === 'text' || el.type === 'sku') && el.dataSource === 'csv_column') {
    const v = row[el.csvColumn] ?? '';
    return { ...(el as TextElement), staticText: v, dataSource: 'static' };
  }
  return el;
}

// ── Progress overlay ─────────────────────────────────────────────────────────

function ProgressOverlay({
  running,
  progress,
  summary,
  startTime,
  onCancel,
  onClose,
  outputDir,
}: {
  running: boolean;
  progress: ExportProgressInfo | null;
  summary: BulkExportSummary | null;
  startTime: number;
  onCancel: () => void;
  onClose: () => void;
  outputDir: string;
}) {
  const elapsed = Date.now() - startTime;
  const pct = progress ? Math.round((progress.index / progress.total) * 100) : summary ? 100 : 0;
  const rate =
    progress && elapsed > 0 ? progress.index / (elapsed / 1000) : 0; // labels/sec
  const remaining =
    progress && rate > 0 && running
      ? Math.round((progress.total - progress.index) / rate)
      : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-border-base bg-bg-surface p-5 shadow-2xl">
        {summary ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <IconCheck size={18} /> Generation complete
            </div>
            <div className="mt-3 text-sm text-fg-base">
              <strong>{summary.generated}</strong> file{summary.generated === 1 ? '' : 's'} generated of {summary.total} item{summary.total === 1 ? '' : 's'}.
            </div>
            {summary.errors.length > 0 && (
              <details className="mt-2 text-xs text-fg-muted">
                <summary className="cursor-pointer text-warning">
                  {summary.errors.length} warning{summary.errors.length === 1 ? '' : 's'}
                </summary>
                <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-border-subtle p-2 font-mono">
                  {summary.errors.slice(0, 50).map((e, i) => (
                    <li key={i} className="truncate">
                      {e}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => window.api.export.revealInFinder(outputDir)}
                disabled={!outputDir}
              >
                <IconFolder size={14} /> Open output folder
              </Button>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold text-fg-base">Generating labels…</div>
            <div className="mt-1 text-xs text-fg-muted">
              {progress
                ? `${progress.index} of ${progress.total} — ${progress.sku}`
                : 'Starting…'}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-fg-subtle">
              <span>Elapsed: {formatDuration(elapsed)}</span>
              <span>{rate ? `${rate.toFixed(1)} /s` : ''}</span>
              <span>{remaining ? `~${formatDuration(remaining * 1000)} left` : ''}</span>
            </div>
            <div className="mt-4 flex items-center justify-end">
              <Button variant="ghost" onClick={onCancel}>
                <IconX size={14} /> Cancel after current item
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s % 60}s`;
}
