import { useState } from 'react';
import {
  IconFileImport,
  IconFileSpreadsheet,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconDownload,
} from '@tabler/icons-react';
import { Button } from '../../components/Button';
import { useBrandStore } from '../../stores/brandStore';
import { useImportStore } from '../../stores/importStore';
import { STANDARD_COLUMNS, REQUIRED_COLUMNS } from '../../../shared/types/import';
import type { DedupAction } from '../../../shared/types/import';

export function ImportFlow() {
  const im = useImportStore();
  const { brands } = useBrandStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-fg-muted">Importing into brand</span>
        <select
          value={im.brandId ?? ''}
          onChange={(e) => im.setBrandId(e.target.value)}
          className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm text-fg-base"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-fg-subtle">
          Step{' '}
          {im.step === 'pickFile'
            ? 1
            : im.step === 'mapAndPreview'
              ? 2
              : im.step === 'dedup'
                ? 3
                : 4}{' '}
          of 4
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
        <div className="text-sm text-fg-muted">Importing…</div>
      )}
      {im.step === 'done' && <StepDone />}
    </div>
  );
}

// ── Step 1: pick a file ─────────────────────────────────────────────────────

function StepPickFile() {
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
          Drop a CSV or Excel file here
        </h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">
          Supported: .csv, .tsv, .xlsx, .xls — up to 50,000 rows. Standard column
          names are auto-detected; you'll be able to confirm the mapping next.
        </p>
        <div className="mt-4 inline-block">
          <Button variant="primary" onClick={onPick}>
            <IconFileSpreadsheet size={14} /> Browse for file…
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-surface px-4 py-3">
        <div>
          <div className="text-sm font-medium text-fg-base">
            Don't have a file yet?
          </div>
          <div className="text-xs text-fg-muted">
            Download a CSV template with all standard columns and one example row.
            Required columns are <code>sku</code>, <code>product_name</code>, and{' '}
            <code>brand</code>; the rest are optional.
          </div>
        </div>
        <Button variant="secondary" onClick={downloadCsvTemplate}>
          <IconDownload size={14} /> Download template
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
        <div className="mb-2 text-sm font-semibold text-fg-base">Column mapping</div>
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
                <option value="">— not mapped —</option>
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
          Unmapped columns ({columns.filter((c) => !mappedSourceCols.has(c)).length}) are
          kept as extra data and never deleted. They can be referenced in templates.
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
          ← Pick a different file
        </Button>
        <Button
          variant="primary"
          disabled={(v?.errors.length ?? 1) > 0}
          onClick={() => im.goToDedup()}
        >
          Check for duplicates →
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
              {validation.errors.length} error
              {validation.errors.length === 1 ? '' : 's'}
            </span>
          )}
          {validation.errors.length > 0 && validation.warnings.length > 0 && (
            <span className="text-fg-subtle">·</span>
          )}
          {validation.warnings.length > 0 && (
            <span className="text-warning">
              {validation.warnings.length} warning
              {validation.warnings.length === 1 ? '' : 's'}
            </span>
          )}
          <span className="ml-auto text-xs text-fg-muted">
            click to show details
          </span>
        </span>
      </summary>
      <div className="scrollbar-thin max-h-72 overflow-y-auto border-t border-border-subtle">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-bg-elevated text-fg-muted">
            <tr>
              <th className="px-3 py-1.5 text-left">Row</th>
              <th className="px-3 py-1.5 text-left">SKU</th>
              <th className="px-3 py-1.5 text-left">Field</th>
              <th className="px-3 py-1.5 text-left">Issue</th>
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
            Showing first 500 issues out of {issues.length}.
          </div>
        )}
      </div>
      {validation.duplicateSkusInFile.length > 0 && (
        <div className="border-t border-border-subtle px-4 py-3 text-xs">
          <div className="font-medium text-fg-base">
            Duplicate SKUs within this file ({validation.duplicateSkusInFile.length})
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
            ? `Generated ${filled} barcode${filled === 1 ? '' : 's'}`
            : `${empty} row${empty === 1 ? '' : 's'} have no barcode`}
        </div>
        <div className="text-xs text-fg-muted">
          {filled !== null
            ? "Codes are valid EAN-13s derived from each row's SKU. They'll be saved alongside the imported rows."
            : "Optionally fill them with valid EAN-13 codes derived from each row's SKU. Same SKU always gets the same code."}
        </div>
        {!barcodeCol && empty > 0 && filled === null && (
          <div className="mt-1 text-[10px] text-fg-subtle">
            A new <code>barcode</code> column will be added to the import.
          </div>
        )}
      </div>
      <Button
        variant={filled === null ? 'primary' : 'secondary'}
        onClick={onClick}
        disabled={working || empty === 0}
      >
        {working
          ? 'Generating…'
          : filled !== null
            ? 'Generate again'
            : 'Generate missing barcodes'}
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
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Stat
        label="Rows OK"
        value={okRows}
        tone="success"
        icon={<IconCheck size={14} />}
      />
      <Stat
        label="Warnings"
        value={warnings}
        tone={warnings > 0 ? 'warning' : 'muted'}
        icon={<IconAlertTriangle size={14} />}
      />
      <Stat
        label="Errors"
        value={errors}
        tone={errors > 0 ? 'danger' : 'muted'}
        icon={<IconX size={14} />}
      />
      <Stat
        label="Dup SKUs in file"
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
          Preview — {filtered.length.toLocaleString()}
          {filtered.length !== rows.length && ` of ${rows.length.toLocaleString()}`}{' '}
          row{filtered.length === 1 ? '' : 's'}
        </span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Filter rows…"
          className="ml-auto w-48 rounded-md border border-border-base bg-bg-base px-2 py-1 text-xs text-fg-base"
        />
        <span>Page size</span>
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
                  No matching rows.
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
            ? '0 rows'
            : `Showing ${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length.toLocaleString()}`}
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
            ‹ Prev
          </button>
          <span className="px-2 font-mono">
            {safePage + 1} / {totalPages}
          </span>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(safePage + 1)}
            className="rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-30"
          >
            Next ›
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
  const im = useImportStore();

  if (im.conflicts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-success/40 bg-success/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-success">
            <IconCheck size={16} /> No duplicates with existing SKUs
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            All rows in this file are new for this brand.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={im.goBack}>
            ← Back
          </Button>
          <Button variant="primary" onClick={() => im.commit()}>
            Import {im.parsed?.rows.length ?? 0} rows
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
        <strong>{im.conflicts.length}</strong> of {im.parsed?.rows.length} SKUs already
        exist in your library for this brand.
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-fg-muted">Apply to all conflicts:</span>
        <DedupChooser
          value={im.defaultDedup}
          onChange={(a) => im.setDefaultDedup(a)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-base">
        <table className="w-full text-xs">
          <thead className="bg-bg-elevated text-fg-muted">
            <tr>
              <th className="px-2 py-1.5 text-left">SKU</th>
              <th className="px-2 py-1.5 text-left">Existing name</th>
              <th className="px-2 py-1.5 text-left">Incoming name</th>
              <th className="px-2 py-1.5 text-left">Action</th>
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
          ← Back
        </Button>
        <Button variant="primary" onClick={() => im.commit()}>
          Import with these decisions
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
  const opts: { value: DedupAction; label: string }[] = [
    { value: 'skip', label: 'Skip' },
    { value: 'overwrite', label: 'Overwrite' },
    { value: 'new_version', label: 'New version' },
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

function StepDone() {
  const im = useImportStore();
  const r = im.result;
  if (!r) return null;
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-success/40 bg-success/10 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-success">
          <IconCheck size={16} /> Import complete
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Inserted" value={r.inserted} tone="success" />
          <Stat label="Overwritten" value={r.overwritten} tone="muted" />
          <Stat label="Skipped" value={r.skipped} tone="muted" />
          <Stat label="New versions" value={r.newVersions} tone="muted" />
        </div>
      </div>
      <div className="flex items-center justify-end">
        <Button variant="primary" onClick={im.reset}>
          Import another file
        </Button>
      </div>
    </div>
  );
}
