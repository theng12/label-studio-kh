import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconBarcode,
  IconFolder,
  IconRefresh,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useBrandStore } from '../stores/brandStore';
import { generateEan13FromSeed } from '../../shared/format';

type Format = 'EAN-13' | 'Code128' | 'Code39' | 'UPC-A';
type Output = 'svg' | 'png';
type Source = 'paste' | 'brand_skus' | 'sequence';

type Progress = { index: number; total: number; value: string };
type Summary = { generated: number; files: string[]; errors: string[] };

export default function Barcodes() {
  const { brands, refresh } = useBrandStore();

  const [source, setSource] = useState<Source>('paste');
  const [pasted, setPasted] = useState('');
  const [brandId, setBrandId] = useState<string>('');
  const [seqStart, setSeqStart] = useState('1000000');
  const [seqCount, setSeqCount] = useState(50);
  const [generateMissingEan13, setGenerateMissingEan13] = useState(true);

  const [format, setFormat] = useState<Format>('EAN-13');
  const [output, setOutput] = useState<Output>('png');
  const [width_mm, setWidth] = useState(50);
  const [height_mm, setHeight] = useState(15);
  const [showText, setShowText] = useState(true);
  const [dpi, setDpi] = useState<150 | 300 | 600>(300);
  const [outputDir, setOutputDir] = useState('');
  const [filenamePrefix, setFilenamePrefix] = useState('');

  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Resolve which list of values to encode based on the current source.
  const values = useMemo<string[]>(() => {
    if (source === 'paste') {
      return pasted
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (source === 'sequence') {
      // Generate a sequence using deterministic EAN-13 based on a seed string.
      const start = parseInt(seqStart || '0', 10);
      const out: string[] = [];
      for (let i = 0; i < seqCount; i += 1) {
        out.push(
          format === 'EAN-13'
            ? generateEan13FromSeed(`seq-${start + i}`)
            : String(start + i),
        );
      }
      return out;
    }
    return []; // brand_skus values are filled via SKU lookup at run time
  }, [source, pasted, seqStart, seqCount, format]);

  const onLoadBrandSkus = async (id: string) => {
    if (!id) return;
    const skus = await window.api.import.listSkus(id);
    const lines = skus.map((s) => {
      const existing = (s.barcode ?? '').trim();
      if (existing) return existing;
      return generateMissingEan13 && s.sku ? generateEan13FromSeed(s.sku) : '';
    });
    setPasted(lines.filter(Boolean).join('\n'));
    setSource('paste');
  };

  const onPickFolder = async () => {
    const folder = await window.api.export.pickFolder(outputDir || undefined);
    if (folder) setOutputDir(folder);
  };

  const onGenerate = async () => {
    if (values.length === 0 || !outputDir) return;
    const id = crypto.randomUUID();
    setRunId(id);
    setRunning(true);
    setSummary(null);
    setProgress(null);
    startRef.current = Date.now();
    const off = window.api.barcode.onProgress(id, (info) => setProgress(info));

    try {
      const result = await window.api.barcode.generateBatch({
        runId: id,
        input: {
          values,
          format,
          output,
          outputDir,
          width_mm,
          height_mm,
          showText,
          filenamePrefix,
          dpi,
          fillEmpty: false,
        },
      });
      setSummary(result);
    } finally {
      off();
      setRunning(false);
    }
  };

  const onCancel = async () => {
    if (runId) await window.api.barcode.cancel(runId);
  };

  const canGenerate = values.length > 0 && !!outputDir && !running;

  return (
    <Page title="Barcode generator">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Values to encode">
          <Field label="Source">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as Source)}
              className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
            >
              <option value="paste">Paste / type a list</option>
              <option value="brand_skus">From a brand's SKUs</option>
              <option value="sequence">Generate a sequence</option>
            </select>
          </Field>

          {source === 'paste' && (
            <Field
              label="One value per line"
              hint={`${values.length.toLocaleString()} value${values.length === 1 ? '' : 's'} ready`}
            >
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={8}
                placeholder="8851234567890\n8851234567891\n…"
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono"
              />
            </Field>
          )}

          {source === 'brand_skus' && (
            <>
              <Field label="Brand">
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                >
                  <option value="">— select brand —</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-xs text-fg-base">
                <input
                  type="checkbox"
                  checked={generateMissingEan13}
                  onChange={(e) => setGenerateMissingEan13(e.target.checked)}
                />
                Generate EAN-13 for SKUs without a saved barcode
              </label>
              <Button
                size="sm"
                variant="secondary"
                disabled={!brandId}
                onClick={() => void onLoadBrandSkus(brandId)}
              >
                <IconRefresh size={14} /> Load this brand's SKUs
              </Button>
              <div className="text-xs text-fg-muted">
                Loads the SKUs into the paste box above so you can review and
                trim before generating.
              </div>
            </>
          )}

          {source === 'sequence' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Seed start">
                <input
                  value={seqStart}
                  onChange={(e) => setSeqStart(e.target.value)}
                  className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono"
                  placeholder="1000000"
                />
              </Field>
              <Field label="Count">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={seqCount}
                  onChange={(e) =>
                    setSeqCount(Math.max(1, Math.min(10000, parseInt(e.target.value, 10) || 1)))
                  }
                  className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                />
              </Field>
              <div className="col-span-2 text-[10px] text-fg-subtle">
                For EAN-13 the seed is hashed so you get valid 13-digit codes.
                For other formats the literal seed+i is encoded.
              </div>
            </div>
          )}
        </Section>

        <Section title="Output">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Format">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              >
                <option>EAN-13</option>
                <option>Code128</option>
                <option>Code39</option>
                <option>UPC-A</option>
              </select>
            </Field>
            <Field label="Output">
              <select
                value={output}
                onChange={(e) => setOutput(e.target.value as Output)}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              >
                <option value="png">PNG (raster)</option>
                <option value="svg">SVG (vector)</option>
              </select>
            </Field>
            <Field label="Width (mm)">
              <input
                type="number"
                min={5}
                step={1}
                value={width_mm}
                onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Height (mm)">
              <input
                type="number"
                min={5}
                step={1}
                value={height_mm}
                onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              />
            </Field>
            {output === 'png' && (
              <Field label="DPI" hint="Higher = sharper but bigger files">
                <select
                  value={dpi}
                  onChange={(e) => setDpi(parseInt(e.target.value, 10) as 150 | 300 | 600)}
                  className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                >
                  <option value={150}>150</option>
                  <option value={300}>300</option>
                  <option value={600}>600</option>
                </select>
              </Field>
            )}
            <Field label="Filename prefix">
              <input
                value={filenamePrefix}
                onChange={(e) => setFilenamePrefix(e.target.value)}
                placeholder="barcode_"
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-fg-base">
            <input
              type="checkbox"
              checked={showText}
              onChange={(e) => setShowText(e.target.checked)}
            />
            Show human-readable text under the barcode
          </label>
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

          <Button
            variant="primary"
            onClick={onGenerate}
            disabled={!canGenerate}
            className="w-full"
          >
            <IconBarcode size={14} /> Generate {values.length}{' '}
            {output.toUpperCase()} barcode{values.length === 1 ? '' : 's'}
          </Button>
        </Section>
      </div>

      {(running || summary) && (
        <ProgressOverlay
          running={running}
          progress={progress}
          summary={summary}
          startTime={startRef.current}
          outputDir={outputDir}
          onCancel={onCancel}
          onClose={() => {
            setSummary(null);
            setProgress(null);
            setRunId(null);
          }}
        />
      )}
    </Page>
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

function ProgressOverlay({
  progress,
  summary,
  startTime,
  outputDir,
  onCancel,
  onClose,
}: {
  running: boolean;
  progress: Progress | null;
  summary: Summary | null;
  startTime: number;
  outputDir: string;
  onCancel: () => void;
  onClose: () => void;
}) {
  const elapsed = Date.now() - startTime;
  const pct = progress
    ? Math.round((progress.index / progress.total) * 100)
    : summary
      ? 100
      : 0;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-border-base bg-bg-surface p-5 shadow-2xl">
        {summary ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <IconCheck size={18} /> Barcode batch complete
            </div>
            <div className="mt-3 text-sm text-fg-base">
              <strong>{summary.generated}</strong> barcode
              {summary.generated === 1 ? '' : 's'} generated.
            </div>
            {summary.errors.length > 0 && (
              <details className="mt-2 text-xs text-fg-muted">
                <summary className="cursor-pointer text-warning">
                  {summary.errors.length} error
                  {summary.errors.length === 1 ? '' : 's'}
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
                <IconFolder size={14} /> Open folder
              </Button>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold text-fg-base">
              Generating barcodes…
            </div>
            <div className="mt-1 text-xs text-fg-muted">
              {progress
                ? `${progress.index} of ${progress.total} — ${progress.value || '(empty)'}`
                : 'Starting…'}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-fg-subtle">
              <span>Elapsed: {Math.round(elapsed / 1000)}s</span>
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
