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
import type { Brand, NewBrandInput } from '../../shared/types/brand';

// Convert an absolute filesystem path to the lskh-file:// URL the renderer
// can use as an <img src>. The custom protocol is registered in main/index.ts.
function localFileUrl(path: string): string {
  // Encode each segment to handle spaces and special chars.
  const segments = path.split('/').map(encodeURIComponent).join('/');
  return `lskh-file://${segments}`;
}

const CATEGORIES = ['FMCG', 'Electronics', 'Hardware', 'Beauty', 'Other'] as const;
const FONTS = ['NotoSans', 'Inter', 'System default'] as const;

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
  defaultFont: 'NotoSans',
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
    defaultFont: b.defaultFont,
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
   * and rewrites the draft's logoPath / certBadges with the resolved paths.
   * Files already saved on the brand pass through unchanged.
   */
  const finaliseAssets = async (
    brandId: string,
    original: { logo: string | null; certs: string[] },
  ): Promise<{ logoPath: string | null; certBadges: string[] }> => {
    let logoPath = draft.logoPath;
    if (logoPath && logoPath !== original.logo) {
      logoPath = await window.api.brand.importAsset(brandId, logoPath, 'logo');
    }

    const certBadges: string[] = [];
    for (const c of draft.certBadges) {
      if (original.certs.includes(c)) {
        certBadges.push(c);
      } else {
        const imported = await window.api.brand.importAsset(brandId, c, 'cert');
        certBadges.push(imported);
      }
    }

    return { logoPath, certBadges };
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      if (isEdit && existing) {
        // Edit: import any new files into the existing brand's assets folder,
        // then write the patch in one update.
        const assets = await finaliseAssets(existing.id, {
          logo: existing.logoPath,
          certs: existing.certBadges,
        });
        await update(existing.id, { ...draft, ...assets });
        onCreated(existing.id);
      } else {
        // Create: persist the brand first (we need its id to scope the asset
        // folder), then import files, then patch the brand with the final
        // permanent paths.
        const brand = await create({ ...draft, logoPath: null, certBadges: [] });
        const assets = await finaliseAssets(brand.id, { logo: null, certs: [] });
        if (assets.logoPath || assets.certBadges.length > 0) {
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
              <LogoUpload
                logoPath={draft.logoPath}
                onChange={(path) => set({ logoPath: path })}
              />
              <p className="text-xs text-fg-subtle">
                Optional. PNG, JPG, JPEG, SVG, or WEBP. Files are copied into
                this brand's assets folder when you finish the wizard.
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
              <Field label="Default font">
                <select
                  value={draft.defaultFont}
                  onChange={(e) => set({ defaultFont: e.target.value })}
                  className="rounded-md border border-border-base bg-bg-surface px-3 py-2 text-sm text-fg-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
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
                label="Logo"
                value={
                  draft.logoPath ? (
                    <img
                      src={localFileUrl(draft.logoPath)}
                      alt="Logo"
                      className="h-6 w-6 rounded border border-border-base bg-white object-contain"
                    />
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
              <ReviewRow label="Default font" value={draft.defaultFont} />
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

// ── Logo upload ──────────────────────────────────────────────────────────────

function LogoUpload({
  logoPath,
  onChange,
}: {
  logoPath: string | null;
  onChange: (path: string | null) => void;
}) {
  const [drag, setDrag] = useState(false);

  const onPick = async () => {
    const path = await window.api.dialog.pickImage();
    if (path) onChange(path);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const filePath = (file as File & { path?: string }).path;
    if (!filePath) return;
    onChange(filePath);
  };

  if (logoPath) {
    return (
      <div className="rounded-lg border border-border-base bg-bg-surface p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-white p-2">
            <img
              src={localFileUrl(logoPath)}
              alt="Logo preview"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-fg-base">Logo</div>
            <div
              className="mt-1 truncate text-xs text-fg-muted"
              title={logoPath}
            >
              {logoPath.split('/').pop()}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={onPick}>
                <IconUpload size={14} /> Replace
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
                <IconTrash size={14} /> Remove
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={[
        'rounded-lg border-2 border-dashed p-10 text-center transition-colors',
        drag ? 'border-accent bg-accent/5' : 'border-border-base bg-bg-surface',
      ].join(' ')}
    >
      <IconPhoto size={28} className="mx-auto text-fg-subtle" />
      <h3 className="mt-2 text-sm font-semibold text-fg-base">Drop a logo here</h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">
        Or pick from your computer. Square or near-square images work best.
      </p>
      <div className="mt-3 inline-block">
        <Button variant="primary" size="sm" onClick={onPick}>
          <IconUpload size={14} /> Choose file…
        </Button>
      </div>
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
