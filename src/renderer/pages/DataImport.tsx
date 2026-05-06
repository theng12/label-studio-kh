import { useEffect, useState } from 'react';
import {
  IconFileImport,
  IconFileSpreadsheet,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconDownload,
  IconPlus,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useBrandStore } from '../stores/brandStore';
import { useImportStore } from '../stores/importStore';
import { STANDARD_COLUMNS, REQUIRED_COLUMNS } from '../../shared/types/import';
import type { DedupAction } from '../../shared/types/import';

type DataTab = 'import' | 'manual' | 'lookup' | 'history';

export default function DataImport() {
  const { brands, refresh } = useBrandStore();
  const im = useImportStore();
  const [tab, setTab] = useState<DataTab>('import');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!im.brandId && brands.length > 0) im.setBrandId(brands[0]!.id);
  }, [brands, im]);

  return (
    <Page title="Data & Import">
      <div className="mb-4 flex gap-1 border-b border-border-base">
        <TabBtn active={tab === 'import'} onClick={() => setTab('import')}>
          Import
        </TabBtn>
        <TabBtn active={tab === 'manual'} onClick={() => setTab('manual')}>
          Manual entry
        </TabBtn>
        <TabBtn active={tab === 'lookup'} onClick={() => setTab('lookup')}>
          SKU lookup
        </TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>
          Import history
        </TabBtn>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-base p-12 text-center text-sm text-fg-muted">
          Create a brand first on the Brands page.
        </div>
      ) : tab === 'import' ? (
        <ImportFlow />
      ) : tab === 'manual' ? (
        <ManualEntry />
      ) : tab === 'lookup' ? (
        <SkuLookup />
      ) : (
        <ImportHistory />
      )}
    </Page>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-2 text-sm transition-colors -mb-px border-b-2',
        active
          ? 'border-accent text-fg-base'
          : 'border-transparent text-fg-muted hover:text-fg-base',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ── Import flow ──────────────────────────────────────────────────────────────

function ImportFlow() {
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
          Step {im.step === 'pickFile' ? 1 : im.step === 'mapAndPreview' ? 2 : im.step === 'dedup' ? 3 : 4} of 4
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
  const csv = [
    headers.join(','),
    exampleRow.map(escape).join(','),
  ].join('\n');

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
        <div className="mb-2 text-sm font-semibold text-fg-base">
          Column mapping
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
          Unmapped columns ({columns.filter((c) => !mappedSourceCols.has(c)).length}) are kept as
          extra data and never deleted. They can be referenced in templates.
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

      <PreviewTable columns={columns} rows={rows.slice(0, 10)} />

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
      <Stat label="Rows OK" value={okRows} tone="success" icon={<IconCheck size={14} />} />
      <Stat
        label="Warnings"
        value={warnings}
        tone={warnings > 0 ? 'warning' : 'muted'}
        icon={<IconAlertTriangle size={14} />}
      />
      <Stat label="Errors" value={errors} tone={errors > 0 ? 'danger' : 'muted'} icon={<IconX size={14} />} />
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

function PreviewTable({ columns, rows }: { columns: string[]; rows: Record<string, string>[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-base">
      <table className="w-full text-xs">
        <thead className="bg-bg-elevated text-fg-muted">
          <tr>
            {columns.map((c) => (
              <th key={c} className="border-b border-border-base px-2 py-1.5 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="text-fg-base">
              {columns.map((c) => (
                <td key={c} className="border-b border-border-subtle px-2 py-1.5 max-w-[180px] truncate">
                  {String(r[c] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
                <td className="border-b border-border-subtle px-2 py-1.5 font-mono">{c.sku}</td>
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

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

function ManualEntry() {
  const { brands } = useBrandStore();
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? '');
  const [draft, setDraft] = useState({
    sku: '',
    product_name: '',
    barcode: '',
    description: '',
    variant: '',
    unit_qty: '',
    unit_word: '',
    product_url: '',
    product_image_path: '',
    date: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<
    | null
    | { kind: 'created'; sku: string }
    | { kind: 'updated'; sku: string }
    | { kind: 'error'; message: string }
  >(null);

  useEffect(() => {
    if (!brandId && brands.length > 0) setBrandId(brands[0]!.id);
  }, [brands, brandId]);

  const set = (patch: Partial<typeof draft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const reset = () => {
    setDraft({
      sku: '',
      product_name: '',
      barcode: '',
      description: '',
      variant: '',
      unit_qty: '',
      unit_word: '',
      product_url: '',
      product_image_path: '',
      date: '',
      notes: '',
    });
  };

  const onSave = async (andAddAnother: boolean) => {
    if (!brandId || !draft.sku.trim()) return;
    setSubmitting(true);
    setStatus(null);
    try {
      // Detect "created" vs "updated" so we can give honest feedback.
      const existing = await window.api.sku.get(brandId, draft.sku.trim());
      const result = await window.api.sku.upsert({
        sku: draft.sku.trim(),
        brand_id: brandId,
        product_name: draft.product_name || null,
        barcode: draft.barcode || null,
        description: draft.description || null,
        variant: draft.variant || null,
        unit_qty: draft.unit_qty || null,
        unit_word: draft.unit_word || null,
        product_url: draft.product_url || null,
        product_image_path: draft.product_image_path || null,
        date: draft.date || null,
        notes: draft.notes || null,
      });
      if (!result) {
        setStatus({ kind: 'error', message: 'Save failed (no result returned).' });
        return;
      }
      setStatus({
        kind: existing ? 'updated' : 'created',
        sku: result.sku,
      });
      if (andAddAnother) reset();
    } catch (err) {
      setStatus({ kind: 'error', message: String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (brands.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-fg-muted">Add to brand</span>
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm text-fg-base"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {status && (
        <div
          className={[
            'rounded-md border p-3 text-sm',
            status.kind === 'error'
              ? 'border-danger/40 bg-danger/10 text-danger'
              : 'border-success/40 bg-success/10 text-success',
          ].join(' ')}
        >
          {status.kind === 'created' && (
            <span className="flex items-center gap-2">
              <IconCheck size={14} /> Created SKU <strong>{status.sku}</strong>.
            </span>
          )}
          {status.kind === 'updated' && (
            <span className="flex items-center gap-2">
              <IconCheck size={14} /> Updated existing SKU <strong>{status.sku}</strong>.
            </span>
          )}
          {status.kind === 'error' && status.message}
        </div>
      )}

      <div className="rounded-lg border border-border-base bg-bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ManualField
            label="SKU"
            required
            value={draft.sku}
            onChange={(v) => set({ sku: v })}
            placeholder="e.g. GH-001"
            mono
          />
          <ManualField
            label="Product name"
            required
            value={draft.product_name}
            onChange={(v) => set({ product_name: v })}
            placeholder="Stainless Grab Bar 60cm"
          />
          <ManualField
            label="Barcode"
            value={draft.barcode}
            onChange={(v) => set({ barcode: v })}
            placeholder="8851234567890"
            mono
            hint="EAN-13, Code128, etc. Leave blank if no barcode."
          />
          <ManualField
            label="Variant"
            value={draft.variant}
            onChange={(v) => set({ variant: v })}
            placeholder="SATIN, WHITE, 60cm"
          />
          <ManualField
            label="Description"
            value={draft.description}
            onChange={(v) => set({ description: v })}
            placeholder="Short product benefit"
          />
          <div className="grid grid-cols-2 gap-3">
            <ManualField
              label="Unit qty"
              value={draft.unit_qty}
              onChange={(v) => set({ unit_qty: v })}
              placeholder="1"
            />
            <ManualField
              label="Unit word"
              value={draft.unit_word}
              onChange={(v) => set({ unit_word: v })}
              placeholder="UNIT, SET, PCS"
            />
          </div>
          <ManualField
            label="Product URL"
            value={draft.product_url}
            onChange={(v) => set({ product_url: v })}
            placeholder="https://example.com/p/sku"
            hint="Used by dynamic QR code elements."
          />
          <ManualField
            label="Image path"
            value={draft.product_image_path}
            onChange={(v) => set({ product_image_path: v })}
            placeholder="images/grab-bar-60.jpg"
            hint="Used by image elements bound to a CSV column."
          />
          <ManualField
            label="Date"
            value={draft.date}
            onChange={(v) => set({ date: v })}
            placeholder="DD/MM/YYYY"
          />
          <ManualField
            label="Notes"
            value={draft.notes}
            onChange={(v) => set({ notes: v })}
            placeholder="Internal — not printed"
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
          <Button
            variant="ghost"
            onClick={reset}
            disabled={submitting}
          >
            Reset form
          </Button>
          <Button
            variant="secondary"
            onClick={() => void onSave(true)}
            disabled={submitting || !draft.sku.trim() || !draft.product_name.trim()}
          >
            <IconPlus size={14} /> Save and add another
          </Button>
          <Button
            variant="primary"
            onClick={() => void onSave(false)}
            disabled={submitting || !draft.sku.trim() || !draft.product_name.trim()}
          >
            <IconDeviceFloppy size={14} />{' '}
            {submitting ? 'Saving…' : 'Save SKU'}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border-subtle bg-bg-base px-4 py-3 text-xs text-fg-muted">
        Saving an existing SKU (same brand + same SKU code) updates the row
        rather than creating a duplicate. To remove a SKU, use the trash icon
        on the SKU lookup tab.
      </div>
    </div>
  );
}

function ManualField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-fg-muted">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          'mt-1 w-full rounded-md border border-border-base bg-bg-base px-2 py-1.5 text-sm text-fg-base placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
          mono ? 'font-mono' : '',
        ].join(' ')}
      />
      {hint && <div className="mt-1 text-[10px] text-fg-subtle">{hint}</div>}
    </label>
  );
}

function SkuLookup() {
  const { brands } = useBrandStore();
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? '');
  const [skus, setSkus] = useState<Awaited<ReturnType<typeof window.api.import.listSkus>>>([]);
  const [query, setQuery] = useState('');

  const reload = async () => {
    if (!brandId) return;
    const list = await window.api.import.listSkus(brandId);
    setSkus(list);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const filtered = skus.filter(
    (s) =>
      s.sku.toLowerCase().includes(query.toLowerCase()) ||
      (s.product_name ?? '').toLowerCase().includes(query.toLowerCase()),
  );

  const onDelete = async (sku: string) => {
    if (!brandId) return;
    if (!window.confirm(`Delete SKU "${sku}"? Generated label files on disk are not affected.`)) {
      return;
    }
    await window.api.sku.delete(brandId, sku);
    await reload();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search SKU or name…"
          className="flex-1 max-w-md rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        />
        <span className="text-xs text-fg-muted">{filtered.length} of {skus.length}</span>
      </div>

      {skus.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
          No SKUs for this brand yet. Import a CSV or add one on the Manual entry tab.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-base">
          <table className="w-full text-xs">
            <thead className="bg-bg-elevated text-fg-muted">
              <tr>
                <th className="px-2 py-1.5 text-left">SKU</th>
                <th className="px-2 py-1.5 text-left">Product</th>
                <th className="px-2 py-1.5 text-left">Barcode</th>
                <th className="px-2 py-1.5 text-left">Variant</th>
                <th className="px-2 py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((s) => (
                <tr key={s.sku} className="hover:bg-bg-hover">
                  <td className="border-b border-border-subtle px-2 py-1.5 font-mono">{s.sku}</td>
                  <td className="border-b border-border-subtle px-2 py-1.5">{s.product_name ?? '—'}</td>
                  <td className="border-b border-border-subtle px-2 py-1.5">{s.barcode ?? '—'}</td>
                  <td className="border-b border-border-subtle px-2 py-1.5">{s.variant ?? '—'}</td>
                  <td className="border-b border-border-subtle px-2 py-1.5 text-right">
                    <button
                      onClick={() => void onDelete(s.sku)}
                      title="Delete this SKU"
                      className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-danger"
                    >
                      <IconX size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div className="bg-bg-elevated px-2 py-1 text-[10px] text-fg-subtle">
              Showing first 200 results.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImportHistory() {
  const [imports, setImports] = useState<
    Awaited<ReturnType<typeof window.api.import.listImports>>
  >([]);

  useEffect(() => {
    window.api.import.listImports().then(setImports);
  }, []);

  if (imports.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
        No imports yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-base">
      <table className="w-full text-xs">
        <thead className="bg-bg-elevated text-fg-muted">
          <tr>
            <th className="px-2 py-1.5 text-left">Date</th>
            <th className="px-2 py-1.5 text-left">File</th>
            <th className="px-2 py-1.5 text-left">Brand ID</th>
            <th className="px-2 py-1.5 text-right">Rows</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((i) => (
            <tr key={i.id}>
              <td className="border-b border-border-subtle px-2 py-1.5">
                {new Date(i.created_at).toLocaleString()}
              </td>
              <td className="border-b border-border-subtle px-2 py-1.5">{i.source_filename ?? '—'}</td>
              <td className="border-b border-border-subtle px-2 py-1.5 font-mono text-fg-subtle">{i.brand_id ?? '—'}</td>
              <td className="border-b border-border-subtle px-2 py-1.5 text-right">{i.row_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
