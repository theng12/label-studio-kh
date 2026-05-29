import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconWand,
  IconFolder,
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconListCheck,
  IconPrinter,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { toast } from '../components/Toast';
import { useBrandStore } from '../stores/brandStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useDefaultBrand } from '../hooks/useDefaultBrand';
import { useJobsStore } from '../stores/jobsStore';
import { ElementView } from '../designer/ElementView';
import { FilenamePatternInput } from '../components/FilenamePatternInput';
import type { Template } from '../../shared/types/template';
import type {
  ExportFormat,
  ExportSettings,
} from '../../preload/index';
import {
  computeSheetGrid,
  DEFAULT_SHEET_LAYOUT,
  type SheetLayout,
} from '../../shared/sheetLayout';

type SkuRow = Awaited<ReturnType<typeof window.api.import.listSkus>>[number];

const DEFAULT_FILENAME_PATTERN = '{SKU}_{Size}';

export default function Generate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { brands, refresh } = useBrandStore();
  const appSettings = useSettingsStore((s) => s.settings);
  const refreshSettings = useSettingsStore((s) => s.refresh);
  const { visibleBrands, defaultBrandId, pickBrand } = useDefaultBrand();
  const [brandId, setBrandIdState] = useState<string>('');
  const setBrandId = (id: string) => {
    setBrandIdState(id);
    if (id) pickBrand(id);
  };
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

  // Currently-tracked runId — populated when the user kicks off a bulk
  // generation. We don't block the UI on it any more; the jobs store owns
  // the lifecycle and a small in-page banner reflects status. Setting to
  // null dismisses the banner.
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const startJob = useJobsStore((s) => s.start);
  const activeJob = useJobsStore((s) =>
    activeRunId ? (s.jobs[activeRunId] ?? null) : null,
  );

  // Scope of the bulk run: 'all' (default) or first-N for sample testing.
  const [sampleScope, setSampleScope] = useState<'all' | 5 | 10 | 25 | 50>('all');

  // Direct printing — printer list + selection + copies + in-flight flag.
  type PrinterInfo = Awaited<ReturnType<typeof window.api.print.listPrinters>>[number];
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  // Print layout: 'roll' = one label per page (thermal); 'sheet' = N-up on
  // A4/Letter (office printers). The sheet config drives both N-up printing
  // and the "Export sheet PDF" button.
  const [printLayout, setPrintLayout] = useState<'roll' | 'sheet'>('roll');
  const [sheet, setSheet] = useState<SheetLayout>(DEFAULT_SHEET_LAYOUT);

  // After a single-row "Generate this one" run, show a small inline result.
  const [singleResult, setSingleResult] = useState<{
    file: string;
    error?: string;
  } | null>(null);
  const [singleSaving, setSingleSaving] = useState(false);

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
    if (!brandId && defaultBrandId) setBrandIdState(defaultBrandId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBrandId]);

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

  // Keep templateId in sync with the loaded templates list. If the user
  // switches brands, the previous brand's templateId is no longer in the
  // list — fall back to the first template of the new brand. If there are
  // no templates at all, clear it.
  useEffect(() => {
    if (templates.length === 0) {
      if (templateId !== '') setTemplateId('');
      return;
    }
    const stillValid = templates.some((tpl) => tpl.id === templateId);
    if (!stillValid) setTemplateId(templates[0]!.id);
  }, [templates, templateId]);

  const template = templates.find((tpl) => tpl.id === templateId) ?? null;
  const brand = brands.find((b) => b.id === brandId) ?? null;
  const previewRow = skus[previewIdx]
    ? skuToRow(skus[previewIdx]!)
    : { sku: 'DEMO-001', product_name: 'Sample Product', barcode: '8851234567890' };

  const isRunning = activeJob?.status === 'running';
  const canGenerate =
    !!template &&
    !!brand &&
    skus.length > 0 &&
    formats.length > 0 &&
    !!outputDir &&
    !isRunning;

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

  /**
   * Generate just the currently-previewed row using the user's real export
   * settings (formats, DPI, folder, naming pattern). Lets you smoke-test the
   * pipeline on one item before committing to the full batch.
   */
  const onGenerateOne = async () => {
    if (!template || !brand || !outputDir) return;
    setSingleSaving(true);
    setSingleResult(null);
    try {
      const r = await window.api.export.single({
        template,
        brand,
        row: previewRow,
        index: previewIdx + 1,
        total: skus.length || 1,
        settings,
      });
      const file = r.files[0];
      setSingleResult({
        file: file ?? '',
        error: r.errors[0],
      });
    } catch (err) {
      setSingleResult({ file: '', error: String(err) });
    } finally {
      setSingleSaving(false);
    }
  };

  const onGenerate = async () => {
    if (!template || !brand || skus.length === 0) return;
    const allRows = skus.map(skuToRow);
    const rows =
      sampleScope === 'all' ? allRows : allRows.slice(0, sampleScope);
    // Fire-and-forget — the jobs store handles progress, completion toast,
    // and OS notification. The local banner is driven by the same store via
    // `activeJob`, so the user sees status here and can also leave.
    const id = await startJob({ template, brand, rows, settings });
    setActiveRunId(id);
  };

  const onCancel = async () => {
    if (activeRunId) await useJobsStore.getState().cancel(activeRunId);
  };

  // Load installed printers once on mount; default to the OS default.
  useEffect(() => {
    void window.api.print.listPrinters().then((list) => {
      setPrinters(list);
      const def = list.find((p) => p.isDefault) ?? list[0];
      if (def) setSelectedPrinter(def.name);
    });
  }, []);

  // Direct print. `silent` true → straight to the selected printer with
  // no dialog ("press print"); false → native print dialog. Uses the same
  // brand/template/rows/scope as Generate so what prints matches the
  // preview + the file export.
  const onPrint = async (silent: boolean) => {
    if (!template || !brand || skus.length === 0) return;
    const allRows = skus.map(skuToRow);
    const rows =
      sampleScope === 'all' ? allRows : allRows.slice(0, sampleScope);
    setPrinting(true);
    try {
      const res = await window.api.print.labels({
        template,
        brand,
        rows,
        deviceName: selectedPrinter || undefined,
        copies,
        silent,
        sheet: printLayout === 'sheet' ? sheet : null,
      });
      toast.success(
        `Sent ${res.printed} label${res.printed === 1 ? '' : 's'}${res.copies > 1 ? ` × ${res.copies} copies` : ''} to print.`,
      );
    } catch (err) {
      // "Print cancelled." comes back when the user dismisses the dialog —
      // show it as info, real failures as error.
      const msg = String(err instanceof Error ? err.message : err);
      if (/cancel/i.test(msg)) toast.info('Print cancelled.');
      else toast.error(msg);
    } finally {
      setPrinting(false);
    }
  };

  // Export one combined N-up PDF (sheet layout) to the output folder.
  const onExportSheetPdf = async () => {
    if (!template || !brand || skus.length === 0 || !outputDir) return;
    const allRows = skus.map(skuToRow);
    const rows =
      sampleScope === 'all' ? allRows : allRows.slice(0, sampleScope);
    setPrinting(true);
    try {
      const res = await window.api.export.sheetPdf({
        template,
        brand,
        rows,
        sheet,
        outputDir,
        overwrite,
      });
      toast.success(`Sheet PDF saved.`, {
        action: {
          label: 'Reveal',
          onClick: () => void window.api.export.revealInFinder(res.file),
        },
      });
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setPrinting(false);
    }
  };

  if (brands.length === 0) {
    return (
      <Page title={t('generate.title')}>
        <Empty msg={t('generate.noBrands')} />
      </Page>
    );
  }

  const labelCount = sampleScope === 'all' ? skus.length : Math.min(sampleScope, skus.length);

  return (
    <Page title={t('generate.title')}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Section title={t('generate.source.title')}>
            <Field label={t('generate.source.brand')}>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              >
                {visibleBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('generate.source.template')}>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={templates.length === 0}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              >
                {templates.length === 0 && (
                  <option>{t('generate.source.noTemplates')}</option>
                )}
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} — {tpl.width_mm}×{tpl.height_mm}mm
                  </option>
                ))}
              </select>
            </Field>

            <div className="text-xs text-fg-muted">
              <strong className="text-fg-base">{skus.length}</strong>{' '}
              {t('generate.source.skuCount', { count: skus.length })}
            </div>
          </Section>

          <Section title={t('generate.output.title')}>
            <Field label={t('generate.output.format')}>
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

            <Field label={t('generate.output.dpi')}>
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

            <Field
              label={t('generate.output.filenamePattern')}
              hint={t('generate.output.filenamePatternHint')}
            >
              <FilenamePatternInput
                value={filenamePattern}
                onChange={setFilenamePattern}
              />
              <div className="mt-1 text-[10px] text-fg-subtle">
                {t('generate.output.exampleFirstRow')}{' '}
                <code className="rounded bg-bg-elevated px-1 py-px">
                  {samplePreview(filenamePattern, previewRow, brand?.name ?? '', template)}
                </code>
              </div>
            </Field>

            <Field label={t('generate.output.saveLocation')}>
              <div className="flex gap-2">
                <input
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  placeholder={t('generate.output.saveLocationPlaceholder')}
                  className="flex-1 rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                />
                <Button onClick={onPickFolder} size="sm">
                  <IconFolder size={14} /> {t('generate.output.browse')}
                </Button>
              </div>
            </Field>

            <Field label={t('generate.output.folderOrg')}>
              <select
                value={folderOrg}
                onChange={(e) => setFolderOrg(e.target.value as typeof folderOrg)}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              >
                <option value="none">{t('generate.output.folderOrgNone')}</option>
                <option value="brand">{t('generate.output.folderOrgBrand')}</option>
                <option value="brand_size">{t('generate.output.folderOrgBrandSize')}</option>
                <option value="brand_template">
                  {t('generate.output.folderOrgBrandTemplate')}
                </option>
              </select>
              <FolderPreview
                outputDir={outputDir}
                folderOrg={folderOrg}
                brandName={brand?.name ?? 'Brand'}
                templateName={template?.name ?? 'Template'}
                sizeLabel={
                  template
                    ? `${template.width_mm}x${template.height_mm}mm`
                    : '50x30mm'
                }
                filenamePattern={filenamePattern}
                sampleRow={previewRow}
                formats={formats}
              />
            </Field>

            <label className="flex items-center gap-2 text-xs text-fg-base">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              {t('generate.output.overwrite')}
            </label>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title={t('generate.preview.title')}>
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
                    <IconChevronLeft size={14} /> {t('generate.preview.prev')}
                  </Button>
                  <span>
                    {skus.length === 0
                      ? t('generate.preview.noData')
                      : t('generate.preview.indexOf', {
                          idx: previewIdx + 1,
                          total: skus.length,
                        })}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={previewIdx >= skus.length - 1 || skus.length === 0}
                    onClick={() => setPreviewIdx(Math.min(skus.length - 1, previewIdx + 1))}
                  >
                    {t('generate.preview.next')} <IconChevronRight size={14} />
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={onPreviewFullSize}
                    disabled={!brand || !template}
                    title={t('generate.preview.previewAsPdfTitle')}
                  >
                    <IconExternalLink size={14} /> {t('generate.preview.previewAsPdf')}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={onGenerateOne}
                    disabled={
                      !brand ||
                      !template ||
                      !outputDir ||
                      formats.length === 0 ||
                      singleSaving
                    }
                    title={t('generate.preview.generateOneTitle')}
                  >
                    <IconWand size={14} />{' '}
                    {singleSaving
                      ? t('generate.preview.generatingOne')
                      : t('generate.preview.generateOne')}
                  </Button>
                </div>
                {singleResult && (
                  <div
                    className={[
                      'mt-2 rounded-md border p-2 text-xs',
                      singleResult.error
                        ? 'border-danger/40 bg-danger/10 text-danger'
                        : 'border-success/40 bg-success/10 text-fg-base',
                    ].join(' ')}
                  >
                    {singleResult.error ? (
                      <span>{singleResult.error}</span>
                    ) : (
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate" title={singleResult.file}>
                          {t('generate.preview.saved', {
                            filename: singleResult.file.split('/').pop(),
                          })}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() =>
                              window.api.export.openInOS(singleResult.file)
                            }
                            className="rounded border border-border-base bg-bg-elevated px-1.5 py-0.5 text-[10px] hover:bg-bg-hover"
                          >
                            {t('generate.preview.open')}
                          </button>
                          <button
                            onClick={() =>
                              window.api.export.revealInFinder(singleResult.file)
                            }
                            className="rounded border border-border-base bg-bg-elevated px-1.5 py-0.5 text-[10px] hover:bg-bg-hover"
                          >
                            {t('generate.preview.reveal')}
                          </button>
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-fg-muted">
                {t('generate.preview.selectTemplate')}
              </div>
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

          {skus.length > 0 && (
            <div className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                <span>{t('generate.scope.label')}</span>
                <select
                  value={String(sampleScope)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSampleScope(v === 'all' ? 'all' : (parseInt(v, 10) as 5 | 10 | 25 | 50));
                  }}
                  className="rounded-md border border-border-base bg-bg-base px-2 py-1 text-xs font-medium text-fg-base"
                >
                  <option value="all">
                    {t('generate.scope.all', { count: skus.length })}
                  </option>
                  <option value="5">{t('generate.scope.first', { n: 5 })}</option>
                  <option value="10">{t('generate.scope.first', { n: 10 })}</option>
                  <option value="25">{t('generate.scope.first', { n: 25 })}</option>
                  <option value="50">{t('generate.scope.first', { n: 50 })}</option>
                </select>
                {sampleScope !== 'all' && (
                  <span className="text-[10px] text-fg-subtle">
                    {t('generate.scope.sampleHint', { n: sampleScope })}
                  </span>
                )}
              </div>
              {/* New-user nudge: a full run on 1000+ SKUs can take minutes
                  and uses real disk. Steer first-timers toward a small
                  sample so they catch font/layout/path issues before
                  committing to a long render. */}
              {sampleScope === 'all' && skus.length > 20 && (
                <div className="mt-1.5 text-[10px] text-fg-subtle">
                  Tip: not sure yet? Switch the dropdown above to{' '}
                  <strong className="text-fg-muted">First 5</strong> or{' '}
                  <strong className="text-fg-muted">First 10</strong> to render
                  a quick sample batch first. Check the output folder, font
                  rendering, and barcode scan before running all{' '}
                  {skus.length.toLocaleString()} labels.
                </div>
              )}
            </div>
          )}

          {/* Inline non-blocking banner reflecting the live status of the
              job we just kicked off. Sits above the Generate button so the
              user gets immediate feedback. Dismissing it doesn't cancel —
              the job keeps running, visible on /jobs and the sidebar. */}
          {activeJob && (
            <InlineJobStatus
              job={activeJob}
              onCancel={onCancel}
              onDismiss={() => setActiveRunId(null)}
              onOpenJobs={() => navigate('/jobs')}
            />
          )}

          <Button
            variant="primary"
            disabled={!canGenerate}
            onClick={onGenerate}
            className="w-full"
            title={canGenerate ? '' : t('generate.generateButtonBlockedTitle')}
          >
            <IconWand size={14} />{' '}
            {isRunning
              ? `Generating in background — ${activeJob?.progress?.index ?? 0}/${activeJob?.total ?? 0}`
              : t('generate.generateButton', {
                  count: labelCount,
                  formats: formats.map((f) => f.toUpperCase()).join('+') || '—',
                })}
          </Button>

          {/* Direct printing — send labels straight to a printer (incl.
              thermal/roll printers with OS drivers) instead of, or in
              addition to, exporting files. Prints the same scope (all or
              First-N) using the same template + data as Generate. */}
          <div className="rounded-lg border border-border-base bg-bg-surface p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg-base">
              <IconPrinter size={15} /> Print directly
            </div>
            {printers.length === 0 ? (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-fg-muted">
                No printers found. Connect a printer (or install its driver)
                and reopen this page. You can still export files above.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Layout toggle — roll (one per page) vs sheet (N-up). */}
                <Field label="Layout">
                  <div className="flex gap-1 rounded-md border border-border-base bg-bg-surface p-0.5">
                    <button
                      onClick={() => setPrintLayout('roll')}
                      className={[
                        'flex-1 rounded px-3 py-1 text-xs',
                        printLayout === 'roll'
                          ? 'bg-accent text-accent-fg'
                          : 'text-fg-muted hover:text-fg-base',
                      ].join(' ')}
                    >
                      One per page (roll)
                    </button>
                    <button
                      onClick={() => setPrintLayout('sheet')}
                      className={[
                        'flex-1 rounded px-3 py-1 text-xs',
                        printLayout === 'sheet'
                          ? 'bg-accent text-accent-fg'
                          : 'text-fg-muted hover:text-fg-base',
                      ].join(' ')}
                    >
                      Sheet (N-up)
                    </button>
                  </div>
                </Field>

                {/* Sheet controls — only in sheet mode. */}
                {printLayout === 'sheet' && template && (
                  <SheetControls
                    sheet={sheet}
                    onChange={setSheet}
                    labelW={template.width_mm}
                    labelH={template.height_mm}
                  />
                )}

                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Field label="Printer">
                    <select
                      value={selectedPrinter}
                      onChange={(e) => setSelectedPrinter(e.target.value)}
                      className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                    >
                      {printers.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.displayName}
                          {p.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Copies">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={copies}
                      onChange={(e) =>
                        setCopies(
                          Math.min(
                            999,
                            Math.max(1, parseInt(e.target.value, 10) || 1),
                          ),
                        )
                      }
                      className="w-20 rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    disabled={!canGenerate || printing}
                    onClick={() => void onPrint(true)}
                    className="flex-1"
                    title="Send straight to the selected printer"
                  >
                    <IconPrinter size={14} />{' '}
                    {printing
                      ? 'Printing…'
                      : `Print ${labelCount} label${labelCount === 1 ? '' : 's'}`}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!canGenerate || printing}
                    onClick={() => void onPrint(false)}
                    title="Open the system print dialog to pick printer + options"
                  >
                    Print dialog…
                  </Button>
                  {printLayout === 'sheet' && (
                    <Button
                      variant="secondary"
                      disabled={!canGenerate || printing}
                      onClick={() => void onExportSheetPdf()}
                      title="Save the N-up layout as a single PDF to your output folder"
                    >
                      <IconFolder size={14} /> Export sheet PDF
                    </Button>
                  )}
                </div>
                <div className="text-[10px] text-fg-subtle">
                  {printLayout === 'roll'
                    ? `One label per page at ${template?.width_mm ?? '—'}×${template?.height_mm ?? '—'}mm — ideal for thermal / roll printers.`
                    : 'Tiles labels across A4/Letter pages for office sheet printers. Adjust margin/gap so they line up with your sticker sheet.'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}

// ── Inline status banner (non-blocking) ─────────────────────────────────────
// Replaces the old full-screen ProgressOverlay modal. Shows live progress
// for a running job + a result summary when it finishes. Critically, the
// rest of the UI stays interactive throughout — the user can navigate to
// Templates / Products / Files while a generation runs.

function InlineJobStatus({
  job,
  onCancel,
  onDismiss,
  onOpenJobs,
}: {
  job: import('../stores/jobsStore').Job;
  onCancel: () => void;
  onDismiss: () => void;
  onOpenJobs: () => void;
}) {
  const { t } = useTranslation();
  const done = job.progress?.index ?? job.summary?.generated ?? 0;
  const pct = job.total > 0 ? Math.round((done / job.total) * 100) : 0;
  const isRunning = job.status === 'running';

  return (
    <div className="rounded-md border border-border-base bg-bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          {isRunning ? (
            <span className="font-medium text-fg-base">
              {t('generate.progress.title')}
            </span>
          ) : job.status === 'completed' ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-success">
              <IconCheck size={14} /> {t('generate.progress.complete')}
            </span>
          ) : job.status === 'cancelled' ? (
            <span className="font-medium text-warning">Cancelled</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-danger">
              <IconAlertCircle size={14} /> Failed
            </span>
          )}
          <span className="ml-2 text-xs text-fg-muted">
            {done}/{job.total} {job.total === 1 ? 'label' : 'labels'}
            {job.progress?.sku && isRunning ? ` · ${job.progress.sku}` : ''}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onOpenJobs}
            className="rounded px-2 py-1 text-[11px] font-medium text-fg-muted hover:bg-bg-hover hover:text-fg-base"
            title="See all jobs"
          >
            <IconListCheck size={12} className="-mt-0.5 mr-1 inline" />
            Open Jobs
          </button>
          {isRunning && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <IconX size={12} /> {t('generate.progress.cancel')}
            </Button>
          )}
          {!isRunning && job.summary?.outputDir && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                window.api.export.revealInFinder(job.summary!.outputDir)
              }
            >
              <IconFolder size={12} /> {t('generate.progress.openFolder')}
            </Button>
          )}
          {!isRunning && (
            <button
              onClick={onDismiss}
              title="Dismiss"
              className="rounded p-1 text-fg-muted hover:text-fg-base"
            >
              <IconX size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={[
            'h-full transition-[width] duration-200',
            isRunning
              ? 'bg-accent'
              : job.status === 'completed'
                ? 'bg-success'
                : job.status === 'failed'
                  ? 'bg-danger'
                  : 'bg-warning',
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {job.summary?.errors && job.summary.errors.length > 0 && (
        <details className="mt-2 text-xs text-fg-muted">
          <summary className="cursor-pointer text-warning">
            {t('generate.progress.warnings', { count: job.summary.errors.length })}
          </summary>
          <ul className="mt-1.5 max-h-32 overflow-y-auto rounded border border-border-subtle p-2 font-mono text-[10px]">
            {job.summary.errors.slice(0, 50).map((e, i) => (
              <li key={i} className="truncate">
                {e}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
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

// Renders a small ASCII-tree preview of where files land for the current
// folderOrg setting. The values used here mirror resolveFolder() in
// ExportService.ts and the export's sanitize(name, 40) so what the user sees
// is exactly what they'll get on disk.
function FolderPreview({
  outputDir,
  folderOrg,
  brandName,
  templateName,
  sizeLabel,
  filenamePattern,
  sampleRow,
  formats,
}: {
  outputDir: string;
  folderOrg: ExportSettings['folderOrganization'];
  brandName: string;
  templateName: string;
  sizeLabel: string;
  filenamePattern: string;
  sampleRow: Record<string, string>;
  formats: ExportFormat[];
}) {
  const { t } = useTranslation();
  // sanitize-ish: mirror ExportService.sanitize for visual fidelity. The real
  // function strips path separators and trims to 40 — close enough for a
  // preview that's bound to update as the user types.
  const sanit = (s: string) =>
    s.replace(/[/\\:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 40);

  const rootLabel = outputDir
    ? outputDir
    : t('generate.output.saveLocationPlaceholder');

  // Build the segments between rootLabel and the file based on org mode.
  const segments: string[] = [];
  if (folderOrg === 'brand' || folderOrg === 'brand_size' || folderOrg === 'brand_template') {
    segments.push(sanit(brandName));
  }
  if (folderOrg === 'brand_size') segments.push(sizeLabel);
  if (folderOrg === 'brand_template') segments.push(sanit(templateName));

  // Apply the same filename pattern the export pipeline uses, with
  // sizeLabel taken from the actual template (passed in) rather than re-
  // parsed from a synthetic Template object. Two sample rows so the user
  // sees the per-row variation.
  const exampleSku = sampleRow.sku || 'DEMO-001';
  const altSku = exampleSku.endsWith('1')
    ? `${exampleSku.slice(0, -1)}2`
    : `${exampleSku}-2`;
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const applyPattern = (sku: string, name: string) =>
    filenamePattern
      .replace(/\{SKU\}/g, sku)
      .replace(/\{Brand\}/g, brandName.replace(/\s+/g, '_'))
      .replace(/\{Size\}/g, sizeLabel)
      .replace(/\{Date\}/g, dateStr)
      .replace(/\{Name\}/g, name.slice(0, 40).replace(/\s+/g, '_'))
      .replace(/\{Index\}/g, '0001');
  const fmt = formats[0] ?? 'pdf';
  const file1 = applyPattern(exampleSku, sampleRow.product_name ?? '');
  const file2 = applyPattern(altSku, sampleRow.product_name ?? '');

  return (
    <div className="mt-2 rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-[10px] leading-relaxed font-mono text-fg-muted">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-fg-subtle font-sans">
        Where files will land
      </div>
      <div className="truncate" title={rootLabel}>
        📁 {rootLabel}/
      </div>
      {segments.map((seg, i) => (
        <div key={i} style={{ paddingLeft: (i + 1) * 14 }}>
          {'└─ '}📁 {seg}/
        </div>
      ))}
      <div style={{ paddingLeft: (segments.length + 1) * 14 }}>
        {'├─ '}📄 {file1}.{fmt}
      </div>
      <div style={{ paddingLeft: (segments.length + 1) * 14 }}>
        {'├─ '}📄 {file2}.{fmt}
      </div>
      <div style={{ paddingLeft: (segments.length + 1) * 14 }}>
        {'└─ '}…
      </div>
      {formats.length > 1 && (
        <div className="mt-1 text-[10px] text-fg-subtle font-sans">
          + same files for each selected format ({formats.map((f) => f.toUpperCase()).join(', ')})
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

// Sheet (N-up) controls — page size / orientation / margin / gap, with a
// live "X per page (C×R)" readout computed from the same shared grid math
// the renderer uses. Warns when the label is too big to fit even once.
function SheetControls({
  sheet,
  onChange,
  labelW,
  labelH,
}: {
  sheet: SheetLayout;
  onChange: (s: SheetLayout) => void;
  labelW: number;
  labelH: number;
}) {
  const grid = computeSheetGrid(labelW, labelH, sheet);
  const set = (patch: Partial<SheetLayout>) => onChange({ ...sheet, ...patch });
  return (
    <div className="rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Page size">
          <select
            value={sheet.pageSize}
            onChange={(e) =>
              set({ pageSize: e.target.value as SheetLayout['pageSize'] })
            }
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          >
            <option value="A4">A4 (210×297mm)</option>
            <option value="Letter">Letter (216×279mm)</option>
          </select>
        </Field>
        <Field label="Orientation">
          <select
            value={sheet.orientation}
            onChange={(e) =>
              set({
                orientation: e.target.value as SheetLayout['orientation'],
              })
            }
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </Field>
        <Field label="Margin (mm)">
          <input
            type="number"
            min={0}
            step={0.5}
            value={sheet.marginMm}
            onChange={(e) =>
              set({ marginMm: Math.max(0, parseFloat(e.target.value) || 0) })
            }
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Gap (mm)">
          <input
            type="number"
            min={0}
            step={0.5}
            value={sheet.gapMm}
            onChange={(e) =>
              set({ gapMm: Math.max(0, parseFloat(e.target.value) || 0) })
            }
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
      <div className="mt-2 text-[11px]">
        {grid.tooBig ? (
          <span className="text-danger">
            Label is too big to fit on this page at this margin. Reduce the
            margin, switch orientation, or pick a larger page.
          </span>
        ) : (
          <span className="text-fg-muted">
            <strong className="text-fg-base">{grid.perPage}</strong> labels per
            page ({grid.columns} × {grid.rows})
          </span>
        )}
      </div>
    </div>
  );
}

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
  const { t } = useTranslation();
  const brandName = brand?.name ?? t('generate.prereq.thisBrand');
  const items: Array<{
    ok: boolean;
    label: string;
    fix?: { label: string; onClick: () => void };
  }> = [
    {
      ok: !!brand,
      label: brand
        ? t('generate.prereq.brandSelected', { name: brand.name })
        : t('generate.prereq.brandNotSelected'),
      fix: !brand
        ? { label: t('generate.prereq.brandFix'), onClick: onGoToBrands }
        : undefined,
    },
    {
      ok: brandHasTemplates && templateSelected,
      label: brandHasTemplates
        ? templateSelected
          ? t('generate.prereq.templateSelected')
          : t('generate.prereq.templatePickAbove')
        : t('generate.prereq.brandHasNoTemplates', { name: brandName }),
      fix: !brandHasTemplates
        ? { label: t('generate.prereq.templateFix'), onClick: onGoToTemplates }
        : undefined,
    },
    {
      ok: skuCount > 0,
      label:
        skuCount > 0
          ? t('generate.prereq.skuReady', { count: skuCount })
          : t('generate.prereq.brandHasNoSkus', { name: brandName }),
      fix: skuCount === 0
        ? { label: t('generate.prereq.skuFix'), onClick: onGoToImport }
        : undefined,
    },
    {
      ok: formatsCount > 0,
      label:
        formatsCount > 0
          ? t('generate.prereq.formatsChosen', { count: formatsCount })
          : t('generate.prereq.formatsNone'),
    },
    {
      ok: outputDirSet,
      label: outputDirSet
        ? t('generate.prereq.outputDirSet')
        : t('generate.prereq.outputDirNone'),
      fix: !outputDirSet
        ? { label: t('generate.prereq.outputDirFix'), onClick: onPickFolder }
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
          ? t('generate.prereq.missingOne')
          : t('generate.prereq.missingMany', { count: blockers.length })}
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
  const { t } = useTranslation();
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
        {t('generate.preview.canvasFooter', {
          w: template.width_mm,
          h: template.height_mm,
        })}
      </div>
    </div>
  );
}

import type { TemplateElement, TextElement } from '../../shared/types/template';

// Mirror of the placeholder rule in StickerRenderer.ts so the Generate-page
// preview shows the same expanded result that the export will produce.
function expandPlaceholders(s: string, row: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    row[k] !== undefined ? String(row[k]) : `{${k}}`,
  );
}

function resolveElement(el: TemplateElement, row: Record<string, string>): TemplateElement {
  if (el.type === 'text' || el.type === 'sku') {
    if (el.dataSource === 'csv_column') {
      const v = row[el.csvColumn] ?? '';
      return { ...(el as TextElement), staticText: v, dataSource: 'static' };
    }
    if (el.dataSource === 'static' && el.staticText.includes('{')) {
      return {
        ...(el as TextElement),
        staticText: expandPlaceholders(el.staticText, row),
      };
    }
  }
  return el;
}

// (The old blocking ProgressOverlay modal lived here. It's been replaced
// by InlineJobStatus near the top of this file plus the /jobs page —
// generation now runs in the background, the user can keep working.)
