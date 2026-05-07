import { useState } from 'react';
import {
  IconX,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconUpload,
  IconTrash,
  IconPhoto,
} from '@tabler/icons-react';
import { Button } from './Button';
import { Field, TextInput, TextArea, ColorInput } from './FormField';
import { useBrandStore } from '../stores/brandStore';
import type { Brand, BrandLogo, NewBrandInput } from '../../shared/types/brand';

// Convert an absolute filesystem path to the lskh-file:// URL the renderer
// can use as an <img src>. The custom protocol is registered in main/index.ts.
function localFileUrl(path: string): string {
  // Encode each segment to handle spaces and special chars.
  const segments = path.split('/').map(encodeURIComponent).join('/');
  return `lskh-file://${segments}`;
}

const CATEGORIES = ['FMCG', 'Electronics', 'Hardware', 'Beauty', 'Other'] as const;

const STEPS = [
  { key: 'basic', title: 'Basic info' },
  { key: 'logo', title: 'Logo' },
  { key: 'identity', title: 'Identity' },
  { key: 'contact', title: 'Contact' },
  { key: 'cert', title: 'Certifications' },
  { key: 'review', title: 'Review' },
] as const;

interface Props {
  onClose: () => void;
  onCreated: (brandId: string) => void;
  // If provided, the wizard runs in "edit" mode — pre-fills fields and updates
  // the existing brand instead of creating a new one.
  existing?: Brand;
}

const DEFAULT_DRAFT: NewBrandInput = {
  name: '',
  color: '#1063E8',
  logoPath: null,
  logos: [],
  website: '',
  address: '',
  phone: '',
  email: '',
  certBadges: [],
  tagline: '',
  establishedYear: '',
  category: 'FMCG',
  customerCareLabel: 'Customer care',
};

function brandToDraft(b: Brand): NewBrandInput {
  return {
    name: b.name,
    color: b.color,
    logoPath: b.logoPath,
    // Lift the legacy single-logo path into the new logos array so the wizard
    // sees a single source of truth.
    logos:
      b.logos && b.logos.length > 0
        ? b.logos
        : b.logoPath
          ? [{ id: 'primary', name: 'Logo', path: b.logoPath }]
          : [],
    website: b.website,
    address: b.address,
    phone: b.phone,
    email: b.email,
    certBadges: b.certBadges,
    tagline: b.tagline,
    establishedYear: b.establishedYear,
    category: b.category ?? 'FMCG',
    customerCareLabel: b.customerCareLabel ?? 'Customer care',
    isDemo: b.isDemo,
    hidden: b.hidden,
  };
}

export function NewBrandWizard({ onClose, onCreated, existing }: Props) {
  const create = useBrandStore((s) => s.create);
  const update = useBrandStore((s) => s.update);
  const isEdit = !!existing;
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<NewBrandInput>(() =>
    existing ? brandToDraft(existing) : DEFAULT_DRAFT,
  );

  const set = (patch: Partial<NewBrandInput>) => setDraft((d) => ({ ...d, ...patch }));

  const canAdvance = () => {
    if (step === 0) return draft.name.trim().length > 0;
    return true;
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  /**
   * Copies any newly-picked files into the brand's permanent assets folder
   * and rewrites the draft's logos / certBadges with the resolved paths.
   * Logos already saved on the brand (their path is in the brand's assets
   * folder already) pass through unchanged. The legacy `logoPath` is also
   * synced to point at the first logo so older readers keep working.
   */
  const finaliseAssets = async (
    brandId: string,
    original: { existingPaths: Set<string> },
  ): Promise<{
    logos: BrandLogo[];
    logoPath: string | null;
    certBadges: string[];
  }> => {
    const logos: BrandLogo[] = [];
    for (const logo of draft.logos ?? []) {
      if (!logo.path) continue;
      if (original.existingPaths.has(logo.path)) {
        logos.push(logo);
      } else {
        const imported = await window.api.brand.importAsset(
          brandId,
          logo.path,
          'logo',
        );
        logos.push({ ...logo, path: imported });
      }
    }

    const certBadges: string[] = [];
    for (const c of draft.certBadges) {
      if (original.existingPaths.has(c)) {
        certBadges.push(c);
      } else {
        const imported = await window.api.brand.importAsset(brandId, c, 'cert');
        certBadges.push(imported);
      }
    }

    return {
      logos,
      logoPath: logos[0]?.path ?? null,
      certBadges,
    };
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      if (isEdit && existing) {
        // Edit mode: anything currently saved on the brand keeps its path;
        // newly-picked files get copied in.
        const existingPaths = new Set<string>([
          ...(existing.logos ?? []).map((l) => l.path),
          ...(existing.logoPath ? [existing.logoPath] : []),
          ...existing.certBadges,
        ]);
        const assets = await finaliseAssets(existing.id, { existingPaths });
        await update(existing.id, { ...draft, ...assets });
        onCreated(existing.id);
      } else {
        // Create mode: persist the brand first (we need its id to scope the
        // asset folder), then import files, then patch the brand with the
        // final permanent paths.
        const brand = await create({
          ...draft,
          logoPath: null,
          logos: [],
          certBadges: [],
        });
        const assets = await finaliseAssets(brand.id, {
          existingPaths: new Set<string>(),
        });
        if (
          assets.logos.length > 0 ||
          assets.certBadges.length > 0
        ) {
          await update(brand.id, assets);
        }
        onCreated(brand.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-base">
      {/* Top bar */}
      <header className="drag-region flex h-14 items-center justify-between border-b border-border-base px-6">
        <div className="flex items-center gap-3 ml-16">
          <h2 className="text-sm font-semibold text-fg-base">
            {isEdit ? `Edit brand — ${existing?.name}` : 'New brand'}
          </h2>
          <span className="text-xs text-fg-muted">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="no-drag rounded-md p-2 text-fg-muted hover:bg-bg-hover hover:text-fg-base"
        >
          <IconX size={18} />
        </button>
      </header>

      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-1 border-b border-border-subtle py-3 px-6">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={[
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold',
                i < step
                  ? 'bg-success text-white'
                  : i === step
                    ? 'bg-accent text-accent-fg'
                    : 'bg-bg-elevated text-fg-subtle',
              ].join(' ')}
            >
              {i < step ? <IconCheck size={12} /> : i + 1}
            </div>
            <span
              className={[
                'text-xs',
                i === step ? 'font-medium text-fg-base' : 'text-fg-muted',
              ].join(' ')}
            >
              {s.title}
            </span>
            {i < STEPS.length - 1 && (
              <div className="mx-2 h-px w-6 bg-border-base" />
            )}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">
          {step === 0 && (
            <div className="space-y-4">
              <Field label="Brand name" hint="Visible in lists and on labels.">
                <TextInput
                  autoFocus
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="e.g. COTTO"
                />
              </Field>
              <Field label="Brand color" hint="Used for color bars and accents.">
                <ColorInput
                  value={draft.color}
                  onChange={(v) => set({ color: v })}
                />
              </Field>
              <Field label="Category">
                <select
                  value={draft.category}
                  onChange={(e) => set({ category: e.target.value })}
                  className="rounded-md border border-border-base bg-bg-surface px-3 py-2 text-sm text-fg-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <LogosManager
                logos={draft.logos ?? []}
                onChange={(logos) => set({ logos })}
              />
              <p className="text-xs text-fg-subtle">
                Optional. Add as many variants as you need (icon mark, wordmark,
                full lockup, monochrome, etc.). The first logo is used by
                default; templates can pick a specific one per Logo element.
                PNG, JPG, JPEG, SVG, or WEBP. Files are copied into this
                brand's assets folder when you finish the wizard.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Field label="Tagline" hint="Optional short slogan.">
                <TextInput
                  value={draft.tagline}
                  onChange={(e) => set({ tagline: e.target.value })}
                  placeholder="e.g. Quality you can trust"
                />
              </Field>
              <Field label="Established year" hint="Optional.">
                <TextInput
                  value={draft.establishedYear}
                  onChange={(e) => set({ establishedYear: e.target.value })}
                  placeholder="e.g. 1989"
                />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Field label="Website">
                <TextInput
                  value={draft.website}
                  onChange={(e) => set({ website: e.target.value })}
                  placeholder="https://example.com"
                />
              </Field>
              <Field label="Address">
                <TextArea
                  value={draft.address}
                  onChange={(e) => set({ address: e.target.value })}
                  placeholder="Street, City, Country"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <TextInput
                    value={draft.phone}
                    onChange={(e) => set({ phone: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <TextInput
                    type="email"
                    value={draft.email}
                    onChange={(e) => set({ email: e.target.value })}
                  />
                </Field>
              </div>
              <Field
                label="Customer care label text"
                hint="Shown next to phone/email on labels."
              >
                <TextInput
                  value={draft.customerCareLabel}
                  onChange={(e) => set({ customerCareLabel: e.target.value })}
                />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <CertBadgesUpload
                certBadges={draft.certBadges}
                onChange={(certs) => set({ certBadges: certs })}
              />
              <p className="text-xs text-fg-subtle">
                Optional. Upload TIS, ISO, or any other certification PNGs you
                want to display on labels for this brand.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-fg-base">Review</h3>
              <ReviewRow label="Name" value={draft.name || '—'} />
              <ReviewRow
                label="Color"
                value={
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 rounded border border-border-base"
                      style={{ background: draft.color }}
                    />
                    <code className="text-xs">{draft.color}</code>
                  </span>
                }
              />
              <ReviewRow label="Category" value={draft.category ?? '—'} />
              <ReviewRow
                label="Logos"
                value={
                  (draft.logos ?? []).length > 0 ? (
                    <span className="flex items-center gap-1">
                      {(draft.logos ?? []).map((l) => (
                        <img
                          key={l.id}
                          src={localFileUrl(l.path)}
                          alt={l.name}
                          title={l.name}
                          className="h-6 w-6 rounded border border-border-base bg-white object-contain"
                        />
                      ))}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <ReviewRow
                label="Certifications"
                value={
                  draft.certBadges.length > 0 ? (
                    <span className="flex items-center gap-1">
                      {draft.certBadges.map((c, i) => (
                        <img
                          key={i}
                          src={localFileUrl(c)}
                          alt=""
                          className="h-6 w-6 rounded border border-border-base bg-white object-contain"
                        />
                      ))}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <ReviewRow label="Tagline" value={draft.tagline || '—'} />
              <ReviewRow label="Established" value={draft.establishedYear || '—'} />
              <ReviewRow label="Website" value={draft.website || '—'} />
              <ReviewRow label="Phone" value={draft.phone || '—'} />
              <ReviewRow label="Email" value={draft.email || '—'} />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="flex h-16 items-center justify-between border-t border-border-base px-6">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={step === 0} onClick={prev}>
            <IconArrowLeft size={14} /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" disabled={!canAdvance()} onClick={next}>
              Next <IconArrowRight size={14} />
            </Button>
          ) : (
            <Button variant="primary" disabled={submitting} onClick={submit}>
              {submitting
                ? isEdit
                  ? 'Saving…'
                  : 'Creating…'
                : isEdit
                  ? 'Save changes'
                  : 'Create brand'}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2">
      <span className="text-xs uppercase tracking-wide text-fg-subtle">{label}</span>
      <span className="text-sm text-fg-base">{value}</span>
    </div>
  );
}

// ── Logos (multi-logo manager) ───────────────────────────────────────────────

const COMMON_LOGO_NAMES = ['Primary', 'Icon', 'Wordmark', 'Lockup', 'Mono', 'Alt'];

function LogosManager({
  logos,
  onChange,
}: {
  logos: BrandLogo[];
  onChange: (logos: BrandLogo[]) => void;
}) {
  const [drag, setDrag] = useState(false);

  // Suggest a sensible default name for a newly added logo, cycling through
  // common labels until one isn't taken yet.
  const nextName = (): string => {
    const taken = new Set(logos.map((l) => l.name.toLowerCase()));
    for (const candidate of COMMON_LOGO_NAMES) {
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `Variant ${logos.length + 1}`;
  };

  const addPaths = (paths: string[]) => {
    if (paths.length === 0) return;
    const next = [...logos];
    for (const p of paths) {
      next.push({ id: crypto.randomUUID(), name: nextName(), path: p });
    }
    onChange(next);
  };

  const onPick = async () => {
    const paths = await window.api.dialog.pickImages();
    addPaths(paths);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const paths: string[] = [];
    for (const file of Array.from(e.dataTransfer.files)) {
      const p = (file as File & { path?: string }).path;
      if (p) paths.push(p);
    }
    addPaths(paths);
  };

  const updateLogo = (id: string, patch: Partial<BrandLogo>) => {
    onChange(logos.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLogo = (id: string) => {
    onChange(logos.filter((l) => l.id !== id));
  };

  const moveLogo = (id: string, dir: -1 | 1) => {
    const i = logos.findIndex((l) => l.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= logos.length) return;
    const next = [...logos];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
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
          'rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          drag ? 'border-accent bg-accent/5' : 'border-border-base bg-bg-surface',
        ].join(' ')}
      >
        <IconPhoto size={28} className="mx-auto text-fg-subtle" />
        <h3 className="mt-2 text-sm font-semibold text-fg-base">
          Drop logo file{logos.length === 0 ? '' : 's'} here
        </h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">
          {logos.length === 0
            ? 'Or pick from your computer. You can add more variants below after the first one.'
            : 'Or pick more from your computer. Each variant is added to the list below.'}
        </p>
        <div className="mt-3 inline-block">
          <Button variant="primary" size="sm" onClick={onPick}>
            <IconUpload size={14} />{' '}
            {logos.length === 0 ? 'Choose file…' : 'Add another logo…'}
          </Button>
        </div>
      </div>

      {logos.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
            Variants ({logos.length})
            <span className="ml-2 font-normal normal-case text-fg-subtle">
              The first one is the default.
            </span>
          </div>
          {logos.map((logo, i) => (
            <div
              key={logo.id}
              className="flex items-center gap-3 rounded-md border border-border-base bg-bg-surface p-3"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-border-subtle bg-white p-1">
                <img
                  src={localFileUrl(logo.path)}
                  alt={logo.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <input
                  value={logo.name}
                  onChange={(e) => updateLogo(logo.id, { name: e.target.value })}
                  placeholder="Variant name (e.g. Icon, Wordmark)"
                  className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-fg-base hover:border-border-base focus:border-accent focus:bg-bg-base focus:outline-none"
                />
                <div
                  className="mt-0.5 truncate px-1 text-[10px] text-fg-subtle"
                  title={logo.path}
                >
                  {logo.path.split('/').pop()}
                  {i === 0 && (
                    <span className="ml-2 rounded bg-accent/15 px-1 text-[9px] font-medium text-accent">
                      default
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveLogo(logo.id, -1)}
                  disabled={i === 0}
                  title="Move up (changes default if moved to top)"
                  className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base disabled:opacity-30"
                >
                  <IconArrowLeft size={14} className="rotate-90" />
                </button>
                <button
                  onClick={() => moveLogo(logo.id, 1)}
                  disabled={i === logos.length - 1}
                  title="Move down"
                  className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base disabled:opacity-30"
                >
                  <IconArrowLeft size={14} className="-rotate-90" />
                </button>
                <button
                  onClick={() => removeLogo(logo.id)}
                  title="Remove this logo"
                  className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-danger"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cert badges upload ───────────────────────────────────────────────────────

function CertBadgesUpload({
  certBadges,
  onChange,
}: {
  certBadges: string[];
  onChange: (paths: string[]) => void;
}) {
  const [drag, setDrag] = useState(false);

  const onPick = async () => {
    const paths = await window.api.dialog.pickImages();
    if (paths.length > 0) onChange([...certBadges, ...paths]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const paths: string[] = [];
    for (const file of Array.from(e.dataTransfer.files)) {
      const p = (file as File & { path?: string }).path;
      if (p) paths.push(p);
    }
    if (paths.length > 0) onChange([...certBadges, ...paths]);
  };

  const removeAt = (i: number) => {
    const next = certBadges.filter((_, idx) => idx !== i);
    onChange(next);
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
          'rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          drag ? 'border-accent bg-accent/5' : 'border-border-base bg-bg-surface',
        ].join(' ')}
      >
        <IconPhoto size={24} className="mx-auto text-fg-subtle" />
        <h3 className="mt-2 text-sm font-semibold text-fg-base">
          Drop certification badges here
        </h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">
          Pick one or many. Each is added to the list below.
        </p>
        <div className="mt-3 inline-block">
          <Button variant="primary" size="sm" onClick={onPick}>
            <IconUpload size={14} /> Choose files…
          </Button>
        </div>
      </div>

      {certBadges.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {certBadges.map((path, i) => (
            <div
              key={`${path}-${i}`}
              className="group relative rounded-md border border-border-base bg-white p-2"
            >
              <div className="flex h-20 items-center justify-center">
                <img
                  src={localFileUrl(path)}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div
                className="mt-1 truncate text-center text-[10px] text-fg-muted"
                title={path}
              >
                {path.split('/').pop()}
              </div>
              <button
                onClick={() => removeAt(i)}
                title="Remove"
                className="absolute right-1 top-1 rounded-full bg-bg-surface p-1 text-fg-muted opacity-0 shadow transition-opacity hover:text-danger group-hover:opacity-100"
              >
                <IconX size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
