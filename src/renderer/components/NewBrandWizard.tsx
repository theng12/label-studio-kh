import { useState } from 'react';
import { IconX, IconArrowLeft, IconArrowRight, IconCheck } from '@tabler/icons-react';
import { Button } from './Button';
import { Field, TextInput, TextArea, ColorInput } from './FormField';
import { useBrandStore } from '../stores/brandStore';
import type { Brand, NewBrandInput } from '../../shared/types/brand';

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

  const submit = async () => {
    setSubmitting(true);
    try {
      if (isEdit && existing) {
        await update(existing.id, draft);
        onCreated(existing.id);
      } else {
        const brand = await create(draft);
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
              <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
                <p className="text-sm text-fg-muted">
                  Logo upload UI lands in the next iteration.
                </p>
                <p className="mt-1 text-xs text-fg-subtle">
                  For now, you can skip this step. A placeholder will be shown on labels until you add one.
                </p>
              </div>
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
              <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
                <p className="text-sm text-fg-muted">
                  Certification badge upload lands in the next iteration.
                </p>
                <p className="mt-1 text-xs text-fg-subtle">
                  You'll be able to upload TIS, ISO, or any custom certification badges.
                </p>
              </div>
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
