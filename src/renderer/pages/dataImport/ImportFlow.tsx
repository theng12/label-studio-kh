import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconFileImport,
  IconFileSpreadsheet,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconDownload,
  IconArrowRight,
} from '@tabler/icons-react';
import { Button } from '../../components/Button';
import { useDefaultBrand } from '../../hooks/useDefaultBrand';
import { useImportStore } from '../../stores/importStore';
import { STANDARD_COLUMNS, REQUIRED_COLUMNS } from '../../../shared/types/import';
import type { DedupAction } from '../../../shared/types/import';

interface ImportFlowProps {
  /** Optional override for the Done screen's "View in Library" CTA.
   *  When provided, it's called with the imported brandId instead of the
   *  default `navigate('/products?brand=…')`. The Import modal uses this
   *  to also close itself after the user clicks View in Library — without
   *  this, the modal would stay open over the Library view. */
  onViewInLibrary?: (brandId: string | null) => void;
}

export function ImportFlow({ onViewInLibrary }: ImportFlowProps = {}) {
  const { t } = useTranslation();
  const im = useImportStore();
  const { visibleBrands, pickBrand } = useDefaultBrand();
  const activeBrand = visibleBrands.find((b) => b.id === im.brandId);

  const stepNumber =
    im.step === 'pickFile'
      ? 1
      : im.step === 'mapAndPreview'
        ? 2
        : im.step === 'dedup'
          ? 3
          : 4;

  return (
    <div className="space-y-4">
      {/* Target-brand banner: makes it explicit which brand will receive the
          imported rows. Without this, "Import 1000 SKUs" is ambiguous when
          the user has more than one brand and the default brand isn't the
          one they meant. */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
        {activeBrand && (
          <span
            className="h-3 w-3 shrink-0 rounded border border-border-base"
            style={{ background: activeBrand.color }}
            aria-hidden
          />
        )}
        <span className="text-xs text-fg-muted">
          {t('dataImport.import.intoBrand')}:
        </span>
        <select
          value={im.brandId ?? ''}
          onChange={(e) => {
            im.setBrandId(e.target.value);
            pickBrand(e.target.value);
          }}
          className="rounded-md border border-border-base bg-bg-base px-2 py-1 text-sm font-medium text-fg-base"
          title="Switch brand to import into a different brand's SKU set"
        >
          {visibleBrands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-fg-subtle">
          Rows below will be saved as SKUs of{' '}
          <strong className="text-fg-muted">{activeBrand?.name ?? '—'}</strong>.
          Change the brand above to retarget.
        </span>
        <span className="ml-auto text-xs text-fg-subtle">
          {t('dataImport.import.stepCount', { step: stepNumber, total: 4 })}
        </span>
      </div>

      {im.error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {im.error}
        </div>
      )}

      {im.step === 'pickFile' && <StepPickFile />}
      {im.step === 'mapAndPreview' && <StepMapAndPreview />}
      {im.step === 'dedup' && <StepDedup />}
      {im.step === 'committing' && (
        <div className="text-sm text-fg-muted">{t('dataImport.import.committing')}</div>
      )}
      {im.step === 'done' && <StepDone onViewInLibrary={onViewInLibrary} />}
    </div>
  );
}

// ── Step 1: pick a file ─────────────────────────────────────────────────────

function StepPickFile() {
  const { t } = useTranslation();
  const im = useImportStore();
  const [drag, setDrag] = useState(false);

  const onPick = async () => {
    const path = await window.api.import.pickFile();
    if (path) await im.loadFile(path);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    // In Electron, dragged-in files expose a `path` property on the File object.
    const filePath = (file as File & { path?: string }).path;
    if (!filePath) return;
    await im.loadFile(filePath);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={[
          'rounded-lg border-2 border-dashed p-12 text-center transition-colors',
          drag ? 'border-accent bg-accent/5' : 'border-border-base bg-bg-surface',
        ].join(' ')}
      >
        <IconFileImport size={32} className="mx-auto text-fg-subtle" />
        <h3 className="mt-3 text-sm font-semibold text-fg-base">
          {t('dataImport.import.pickFile.title')}
        </h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">
          {t('dataImport.import.pickFile.hint')}
        </p>
        <div className="mt-4 inline-flex items-center gap-2">
          <Button variant="primary" onClick={onPick}>
            <IconFileSpreadsheet size={14} /> {t('dataImport.import.pickFile.browse')}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-surface px-4 py-3">
        <div>
          <div className="text-sm font-medium text-fg-base">
            {t('dataImport.import.pickFile.dontHave')}
          </div>
          <div className="text-xs text-fg-muted">
            {t('dataImport.import.pickFile.templateExplain')}
          </div>
        </div>
        <Button variant="secondary" onClick={downloadCsvTemplate}>
          <IconDownload size={14} /> {t('dataImport.import.pickFile.downloadTemplate')}
        </Button>
      </div>
    </div>
  );
}

function downloadCsvTemplate(): void {
  // Standard 12 columns per spec §4.5, with one example row showing realistic
  // values. Required columns are flagged in the column-mapping UI; this CSV
  // includes all of them so users can fill or delete what they need.
  const headers = [
    'sku',
    'product_name',
    'brand',
    'barcode',
    'description',
    'variant',
    'unit_qty',
    'unit_word',
    'product_url',
    'product_image_path',
    'date',
    'notes',
  ];
  const exampleRow = [
    'EXAMPLE-001',
    'Stainless Grab Bar 60cm',
    'Your Brand',
    '8851234567890',
    'Bathroom safety, wall-mounted',
    'SATIN',
    '1',
    'UNIT',
    'https://example.com/p/EXAMPLE-001',
    'images/grab-bar-60cm.jpg',
    '06/05/2026',
    'Internal note (not printed on the label)',
  ];

  const escape = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const csv = [headers.join(','), exampleRow.map(escape).join(',')].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'label-studio-kh-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ── Step 2: column mapping + preview ────────────────────────────────────────

function StepMapAndPreview() {
  const { t } = useTranslation();
  const im = useImportStore();
  if (!im.parsed) return null;
  const { columns, rows } = im.parsed;
  const v = im.validation;

  const mappedSourceCols = new Set(
    Object.values(im.mapping).filter((c): c is string => Boolean(c)),
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-base bg-bg-surface p-4">
        <div className="mb-2 text-sm font-semibold text-fg-base">
          {t('dataImport.import.mapping.title')}
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {STANDARD_COLUMNS.map((std) => (
            <div key={std} className="flex items-center gap-2">
              <span className="w-32 text-xs text-fg-muted">
                {std}
                {(REQUIRED_COLUMNS as readonly string[]).includes(std) && (
                  <span className="ml-1 text-danger">*</span>
                )}
              </span>
              <span className="text-fg-subtle">→</span>
              <select
                value={im.mapping[std] ?? ''}
                onChange={(e) => {
                  im.setMappingField(std, e.target.value || null);
                  void im.validate();
                }}
                className="flex-1 rounded-md border border-border-base bg-bg-base px-2 py-1.5 text-sm text-fg-base"
              >
                <option value="">{t('dataImport.import.mapping.notMapped')}</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-fg-subtle">
          {t('dataImport.import.mapping.unmappedHint', {
            count: columns.filter((c) => !mappedSourceCols.has(c)).length,
          })}
        </div>
      </div>

      {v && (
        <ValidationSummary
          okRows={v.okRowCount}
          warnings={v.warnings.length}
          errors={v.errors.length}
          duplicatesInFile={v.duplicateSkusInFile.length}
        />
      )}

      {v && (v.warnings.length > 0 || v.errors.length > 0) && (
        <IssuesList validation={v} rows={rows} mapping={im.mapping} />
      )}

      <BarcodeFiller mapping={im.mapping} />

      <PaginatedPreviewTable columns={columns} rows={rows} />

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => im.goBack()}>
          {t('dataImport.import.preview.pickDifferent')}
        </Button>
        <Button
          variant="primary"
          disabled={(v?.errors.length ?? 1) > 0}
          onClick={() => im.goToDedup()}
        >
          {t('dataImport.import.preview.checkDuplicates')}
        </Button>
      </div>
    </div>
  );
}

// ── Issues list: warnings + errors with row context ─────────────────────────

function IssuesList({
  validation,
  rows,
  mapping,
}: {
  validation: import('../../../shared/types/import').ValidationResult;
  rows: Record<string, string>[];
  mapping: import('../../../shared/types/import').ColumnMapping;
}) {
  const { t } = useTranslation();
  const skuCol = mapping['sku'];
  const issues = [
    ...validation.errors.map((i) => ({ ...i, kind: 'error' as const })),
    ...validation.warnings.map((i) => ({ ...i, kind: 'warning' as const })),
  ];
  if (issues.length === 0) return null;

  return (
    <details className="rounded-lg border border-border-base bg-bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-fg-base">
        <span className="flex items-center gap-2">
          <IconAlertTriangle size={14} className="text-warning" />
          {validation.errors.length > 0 && (
            <span className="text-danger">
              {t('dataImport.import.issues.errors', {
                count: validation.errors.length,
              })}
            </span>
          )}
          {validation.errors.length > 0 && validation.warnings.length > 0 && (
            <span className="text-fg-subtle">·</span>
          )}
          {validation.warnings.length > 0 && (
            <span className="text-warning">
              {t('dataImport.import.issues.warnings', {
                count: validation.warnings.length,
              })}
            </span>
          )}
          <span className="ml-auto text-xs text-fg-muted">
            {t('dataImport.import.issues.clickToShow')}
          </span>
        </span>
      </summary>
      <div className="scrollbar-thin max-h-72 overflow-y-auto border-t border-border-subtle">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-bg-elevated text-fg-muted">
            <tr>
              <th className="px-3 py-1.5 text-left">{t('dataImport.import.issues.row')}</th>
              <th className="px-3 py-1.5 text-left">{t('dataImport.import.issues.sku')}</th>
              <th className="px-3 py-1.5 text-left">{t('dataImport.import.issues.field')}</th>
              <th className="px-3 py-1.5 text-left">{t('dataImport.import.issues.issue')}</th>
            </tr>
          </thead>
          <tbody>
            {issues.slice(0, 500).map((i, idx) => (
              <tr key={idx} className={i.kind === 'error' ? 'bg-danger/5' : ''}>
                <td className="border-b border-border-subtle px-3 py-1 font-mono text-fg-muted">
                  {i.rowIndex >= 0 ? i.rowIndex + 1 : '—'}
                </td>
                <td className="border-b border-border-subtle px-3 py-1 font-mono">
                  {i.rowIndex >= 0 && skuCol
                    ? String(rows[i.rowIndex]?.[skuCol] ?? '—')
                    : '—'}
                </td>
                <td className="border-b border-border-subtle px-3 py-1 text-fg-muted">
                  {i.field ?? '—'}
                </td>
                <td
                  className={[
                    'border-b border-border-subtle px-3 py-1',
                    i.kind === 'error' ? 'text-danger' : 'text-fg-base',
                  ].join(' ')}
                >
                  {i.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {issues.length > 500 && (
          <div className="bg-bg-elevated px-3 py-1 text-[10px] text-fg-subtle">
            {t('dataImport.import.issues.showingFirst', { total: issues.length })}
          </div>
        )}
      </div>
      {validation.duplicateSkusInFile.length > 0 && (
        <div className="border-t border-border-subtle px-4 py-3 text-xs">
          <div className="font-medium text-fg-base">
            {t('dataImport.import.issues.duplicates', {
              count: validation.duplicateSkusInFile.length,
            })}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {validation.duplicateSkusInFile.map((s) => (
              <code
                key={s}
                className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-fg-muted"
              >
                {s}
              </code>
            ))}
          </div>
        </div>
      )}
    </details>
  );
}

// ── Generate missing barcodes ───────────────────────────────────────────────

function BarcodeFiller({
  mapping,
}: {
  mapping: import('../../../shared/types/import').ColumnMapping;
}) {
  const { t } = useTranslation();
  const im = useImportStore();
  const [filled, setFilled] = useState<number | null>(null);
  const [working, setWorking] = useState(false);

  const skuCol = mapping['sku'];
  const barcodeCol = mapping['barcode'];

  // Count rows with empty barcode (only meaningful when sku is mapped)
  const empty = im.parsed
    ? im.parsed.rows.filter(
        (r) =>
          (skuCol ? String(r[skuCol] ?? '').trim() : '') &&
          (!barcodeCol || !String(r[barcodeCol] ?? '').trim()),
      ).length
    : 0;

  if (!skuCol) return null;
  if (empty === 0 && filled === null) return null;

  const onClick = async () => {
    setWorking(true);
    try {
      const n = await im.fillMissingBarcodes();
      setFilled(n);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-surface px-4 py-3">
      <div>
        <div className="text-sm font-medium text-fg-base">
          {filled !== null
            ? t('dataImport.import.barcodes.generated', { count: filled })
            : t('dataImport.import.barcodes.empty', { count: empty })}
        </div>
        <div className="text-xs text-fg-muted">
          {filled !== null
            ? t('dataImport.import.barcodes.hintGenerated')
            : t('dataImport.import.barcodes.hintAvailable')}
        </div>
        {!barcodeCol && empty > 0 && filled === null && (
          <div className="mt-1 text-[10px] text-fg-subtle">
            {t('dataImport.import.barcodes.newColumn')}
          </div>
        )}
      </div>
      <Button
        variant={filled === null ? 'primary' : 'secondary'}
        onClick={onClick}
        disabled={working || empty === 0}
      >
        {working
          ? t('dataImport.import.barcodes.generating')
          : filled !== null
            ? t('dataImport.import.barcodes.generateAgain')
            : t('dataImport.import.barcodes.generate')}
      </Button>
    </div>
  );
}

function ValidationSummary({
  okRows,
  warnings,
  errors,
  duplicatesInFile,
}: {
  okRows: number;
  warnings: number;
  errors: number;
  duplicatesInFile: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Stat
        label={t('dataImport.import.validation.okRows')}
        value={okRows}
        tone="success"
        icon={<IconCheck size={14} />}
      />
      <Stat
        label={t('dataImport.import.validation.warnings')}
        value={warnings}
        tone={warnings > 0 ? 'warning' : 'muted'}
        icon={<IconAlertTriangle size={14} />}
      />
      <Stat
        label={t('dataImport.import.validation.errors')}
        value={errors}
        tone={errors > 0 ? 'danger' : 'muted'}
        icon={<IconX size={14} />}
      />
      <Stat
        label={t('dataImport.import.validation.duplicates')}
        value={duplicatesInFile}
        tone={duplicatesInFile > 0 ? 'warning' : 'muted'}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger' | 'muted';
  icon?: React.ReactNode;
}) {
  const colorMap = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    muted: 'text-fg-muted',
  } as const;
  return (
    <div className="rounded-md border border-border-base bg-bg-surface p-3">
      <div className={['text-xs flex items-center gap-1', colorMap[tone]].join(' ')}>
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold text-fg-base">{value}</div>
    </div>
  );
}

function PaginatedPreviewTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, string>[];
}) {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');

  // Filter (substring across any column) before paginating.
  const filtered = query
    ? rows.filter((r) =>
        columns.some((c) =>
          String(r[c] ?? '').toLowerCase().includes(query.toLowerCase()),
        ),
      )
    : rows;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  return (
    <div className="rounded-lg border border-border-base bg-bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2 text-xs text-fg-muted">
        <span className="font-medium text-fg-base">
          {filtered.length !== rows.length
            ? t('dataImport.import.preview.rowCountFiltered', {
                shown: filtered.length.toLocaleString(),
                total: rows.length.toLocaleString(),
                count: filtered.length,
              })
            : t('dataImport.import.preview.rowCount', {
                shown: filtered.length.toLocaleString(),
                count: filtered.length,
              })}
        </span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder={t('dataImport.import.preview.filterPlaceholder')}
          className="ml-auto w-48 rounded-md border border-border-base bg-bg-base px-2 py-1 text-xs text-fg-base"
        />
        <span>{t('dataImport.import.preview.pageSize')}</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(parseInt(e.target.value, 10));
            setPage(0);
          }}
          className="rounded-md border border-border-base bg-bg-base px-1.5 py-1 text-xs"
        >
          {[10, 20, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-bg-elevated text-fg-muted">
            <tr>
              <th className="w-10 border-b border-border-base px-2 py-1.5 text-right font-medium">
                #
              </th>
              {columns.map((c) => (
                <th
                  key={c}
                  className="border-b border-border-base px-2 py-1.5 text-left font-medium"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-3 py-6 text-center text-fg-muted"
                >
                  {t('dataImport.import.preview.noMatching')}
                </td>
              </tr>
            ) : (
              visible.map((r, i) => (
                <tr key={start + i} className="text-fg-base hover:bg-bg-hover">
                  <td className="border-b border-border-subtle px-2 py-1 text-right font-mono text-fg-subtle">
                    {start + i + 1}
                  </td>
                  {columns.map((c) => (
                    <td
                      key={c}
                      className="border-b border-border-subtle px-2 py-1 max-w-[200px] truncate"
                      title={String(r[c] ?? '')}
                    >
                      {String(r[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border-subtle px-3 py-2 text-xs text-fg-muted">
        <span>
          {filtered.length === 0
            ? t('dataImport.import.preview.zeroRows')
            : t('dataImport.import.preview.showing', {
                from: start + 1,
                to: Math.min(start + pageSize, filtered.length),
                total: filtered.length.toLocaleString(),
              })}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={safePage === 0}
            onClick={() => setPage(0)}
            className="rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-30"
          >
            ⟪
          </button>
          <button
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            className="rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-30"
          >
            ‹ {t('dataImport.import.preview.prev')}
          </button>
          <span className="px-2 font-mono">
            {safePage + 1} / {totalPages}
          </span>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(safePage + 1)}
            className="rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-30"
          >
            {t('dataImport.import.preview.next')} ›
          </button>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
            className="rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-30"
          >
            ⟫
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: dedup decisions ─────────────────────────────────────────────────

function StepDedup() {
  const { t } = useTranslation();
  const im = useImportStore();

  if (im.conflicts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-success/40 bg-success/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-success">
            <IconCheck size={16} /> {t('dataImport.import.dedup.noConflicts')}
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            {t('dataImport.import.dedup.allNew')}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={im.goBack}>
            {t('dataImport.import.dedup.back')}
          </Button>
          <Button variant="primary" onClick={() => im.commit()}>
            {t('dataImport.import.dedup.importRows', {
              count: im.parsed?.rows.length ?? 0,
            })}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
        {t('dataImport.import.dedup.conflictsHeader', {
          count: im.conflicts.length,
          total: im.parsed?.rows.length ?? 0,
        })}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-fg-muted">{t('dataImport.import.dedup.applyAll')}</span>
        <DedupChooser
          value={im.defaultDedup}
          onChange={(a) => im.setDefaultDedup(a)}
        />
      </div>

      {/* Cap height so the action bar below stays reachable without scrolling
          past every conflict row. Sticky thead keeps column labels visible
          while the user reviews. Same pattern as the IssuesList above. */}
      <div className="scrollbar-thin max-h-[60vh] overflow-auto rounded-lg border border-border-base">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-bg-elevated text-fg-muted">
            <tr>
              <th className="px-2 py-1.5 text-left">
                {t('dataImport.import.dedup.table.sku')}
              </th>
              <th className="px-2 py-1.5 text-left">
                {t('dataImport.import.dedup.table.existing')}
              </th>
              <th className="px-2 py-1.5 text-left">
                {t('dataImport.import.dedup.table.incoming')}
              </th>
              <th className="px-2 py-1.5 text-left">
                {t('dataImport.import.dedup.table.action')}
              </th>
            </tr>
          </thead>
          <tbody>
            {im.conflicts.map((c) => (
              <tr key={c.sku}>
                <td className="border-b border-border-subtle px-2 py-1.5 font-mono">
                  {c.sku}
                </td>
                <td className="border-b border-border-subtle px-2 py-1.5">
                  {c.existing.productName ?? '—'}
                </td>
                <td className="border-b border-border-subtle px-2 py-1.5">
                  {c.incoming.productName ?? '—'}
                </td>
                <td className="border-b border-border-subtle px-2 py-1.5">
                  <DedupChooser
                    value={im.perSkuDedup[c.sku] ?? im.defaultDedup}
                    onChange={(a) => im.setSkuDedup(c.sku, a)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={im.goBack}>
          {t('dataImport.import.dedup.back')}
        </Button>
        <Button variant="primary" onClick={() => im.commit()}>
          {t('dataImport.import.dedup.importDecisions')}
        </Button>
      </div>
    </div>
  );
}

function DedupChooser({
  value,
  onChange,
}: {
  value: DedupAction;
  onChange: (a: DedupAction) => void;
}) {
  const { t } = useTranslation();
  const opts: { value: DedupAction; label: string }[] = [
    { value: 'skip', label: t('dataImport.import.dedup.action.skip') },
    { value: 'overwrite', label: t('dataImport.import.dedup.action.overwrite') },
    { value: 'new_version', label: t('dataImport.import.dedup.action.newVersion') },
  ];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as DedupAction)}
      className="rounded-md border border-border-base bg-bg-surface px-2 py-1 text-xs"
    >
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Step 4: done ────────────────────────────────────────────────────────────

function StepDone({
  onViewInLibrary,
}: {
  onViewInLibrary?: (brandId: string | null) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const im = useImportStore();
  const r = im.result;
  // Brand the import was scoped to — used by the "View in Library" CTA to
  // jump the Products page back to the Library tab pre-filtered to that
  // brand so users can immediately see their newly-imported SKUs. Solves
  // the "I imported a CSV but I can't find the new rows" confusion.
  const targetBrandId = im.brandId;
  if (!r) return null;
  const hasInsertedRows = (r.inserted ?? 0) > 0 || (r.newVersions ?? 0) > 0;
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-success/40 bg-success/10 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-success">
          <IconCheck size={16} /> {t('dataImport.import.done.title')}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label={t('dataImport.import.done.inserted')} value={r.inserted} tone="success" />
          <Stat label={t('dataImport.import.done.overwritten')} value={r.overwritten} tone="muted" />
          <Stat label={t('dataImport.import.done.skipped')} value={r.skipped} tone="muted" />
          <Stat label={t('dataImport.import.done.newVersions')} value={r.newVersions} tone="muted" />
        </div>
        {hasInsertedRows && (
          <div className="mt-3 text-xs text-fg-muted">
            New rows landed in the <strong>{im.brandId ? 'selected brand' : 'workspace'}</strong>.
            Click <em>View in Library</em> to see them — the Library will jump
            to that brand automatically.
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={im.reset}>
          {t('dataImport.import.done.another')}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            if (onViewInLibrary) {
              // Modal context — close the modal + apply the brand filter
              // via the callback. The modal owns the close behaviour; we
              // just hand back the brand id we imported into.
              onViewInLibrary(targetBrandId ?? null);
              im.reset();
              return;
            }
            // Standalone /data route — fall back to the deep-link. Products
            // page reads ?brand= on mount and forces that brand into the
            // filter (see productsBrandInitialized in Products.tsx).
            im.reset();
            const qs = new URLSearchParams();
            if (targetBrandId) qs.set('brand', targetBrandId);
            navigate(`/products?${qs.toString()}`);
          }}
        >
          View in Library <IconArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}
