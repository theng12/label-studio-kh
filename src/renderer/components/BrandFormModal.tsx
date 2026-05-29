// Single-page modal for creating / editing a brand. Replaces the old
// six-step NewBrandWizard — the user explicitly asked for "all on one
// page" because multi-step was hard to manage for a record this small.
//
// Layout:
//   - Top:    Name (required) + Color swatches + Icon upload
//   - Bottom: "Brand details" disclosure with the long-tail fields
//             (tagline, website, address, phone, email, customer-care
//             label, established year, category). Folded by default so
//             the modal isn't intimidating; user can expand to fill
//             whatever's relevant.
//
// Behaviour:
//   - Esc + clicking the dim backdrop dismiss (per AGENTS.md §2).
//   - "Create" / "Save changes" CTA bottom-right; "Cancel" next to it.
//   - Logo upload imports the file into the brand's permanent assets
//     folder on save, replacing any previously-imported logo. Picking
//     a new file before save just stages the absolute path; the import
//     happens once during the final create/update so we don't litter
//     the assets folder with abandoned uploads.

import { useState } from 'react';
import { IconPhoto, IconTrash, IconUpload } from '@tabler/icons-react';
import { Button } from './Button';
import { Field, TextInput, TextArea } from './FormField';
import { Modal } from './Modal';
import { useBrandStore } from '../stores/brandStore';
import { useCompanyStore } from '../stores/companyStore';
import type { Brand, BrandLogo, NewBrandInput } from '../../shared/types/brand';

// Renderer-side preview helper. Custom protocol registered in main.
function localFileUrl(path: string): string {
  const segments = path.split('/').map(encodeURIComponent).join('/');
  return `lskh-file://${segments}`;
}

// Curated palette — matches the Image Studio KH reference screenshot.
// Eight options keeps the chooser one row on every reasonable width.
const COLOR_PRESETS = [
  '#1063E8', // blue
  '#16A34A', // green
  '#C2410C', // orange
  '#DC2626', // red
  '#9333EA', // purple
  '#0891B2', // teal
  '#111827', // near-black
  // Gradient option — value stored as the bright yellow, the swatch
  // just renders a CSS gradient so it reads as "rainbow / custom".
  '#FACC15',
] as const;

const CATEGORIES = ['FMCG', 'Electronics', 'Hardware', 'Beauty', 'Other'] as const;

interface Props {
  /** When provided, runs in edit mode — fields pre-filled, save calls
   *  update(); when omitted, runs in create mode. */
  existing?: Brand;
  onClose: () => void;
  /** Called after a successful save. Brand id is passed so the caller
   *  can navigate (e.g. to /templates?brand=<id>). */
  onSaved: (brandId: string) => void;
}

const EMPTY_DRAFT: NewBrandInput = {
  name: '',
  color: COLOR_PRESETS[0],
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
    hidden: b.hidden,
  };
}

/** Compact initials fallback when there's no logo yet — first two
 *  meaningful letters of the brand name, falling back to "BR". */
function initialsFor(name: string): string {
  const stripped = name.replace(/[^A-Za-z0-9]/g, '');
  return (stripped.slice(0, 2) || 'BR').toUpperCase();
}

export function BrandFormModal({ existing, onClose, onSaved }: Props) {
  const create = useBrandStore((s) => s.create);
  const update = useBrandStore((s) => s.update);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const isEdit = !!existing;

  const [draft, setDraft] = useState<NewBrandInput>(() =>
    existing ? brandToDraft(existing) : EMPTY_DRAFT,
  );
  // Staged-but-not-imported logo path (renderer side). When the user
  // picks a new file, we keep the absolute path here for preview. On
  // save, we import it into the brand's assets folder, then write the
  // returned permanent path to draft.logos.
  const [stagedLogoPath, setStagedLogoPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<NewBrandInput>) =>
    setDraft((d) => ({ ...d, ...patch }));

  // Resolved preview source: staged file first (most recent pick wins
  // over already-saved logo), then the existing first-logo path.
  const previewPath =
    stagedLogoPath ?? draft.logos?.[0]?.path ?? draft.logoPath ?? null;

  const pickLogo = async () => {
    const path = await window.api.dialog.pickImage();
    if (path) setStagedLogoPath(path);
  };

  const removeLogo = () => {
    setStagedLogoPath(null);
    set({ logos: [], logoPath: null });
  };

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return; // button is disabled in this case but be defensive
    setSaving(true);
    try {
      // Resolve the staged-vs-permanent logo before persisting. If the
      // user picked a new file, import it; if they removed it, draft is
      // already empty.
      if (isEdit && existing) {
        let logos: BrandLogo[] = draft.logos ?? [];
        let logoPath = draft.logoPath ?? null;
        if (stagedLogoPath) {
          const imported = await window.api.brand.importAsset(
            existing.id,
            stagedLogoPath,
            'logo',
          );
          logos = [{ id: 'primary', name: 'Logo', path: imported }];
          logoPath = imported;
        }
        await update(existing.id, { ...draft, name, logos, logoPath });
        onSaved(existing.id);
      } else {
        // Create flow: persist first (we need an id to scope the asset
        // folder), then import the staged file, then patch the brand
        // with the permanent path.
        const created = await create({
          ...draft,
          name,
          companyId: activeCompanyId ?? undefined,
        });
        if (stagedLogoPath) {
          const imported = await window.api.brand.importAsset(
            created.id,
            stagedLogoPath,
            'logo',
          );
          await update(created.id, {
            logos: [{ id: 'primary', name: 'Logo', path: imported }],
            logoPath: imported,
          });
        }
        onSaved(created.id);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit ${existing!.name}` : 'New brand'}
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={saving || draft.name.trim().length === 0}
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name *">
          <TextInput
            autoFocus
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. BBC"
          />
        </Field>

        {/* Color — preset palette. The last swatch shows a gradient so
            users see a hint of "any color"; clicking it still picks the
            stored hex (yellow), but the gradient communicates flexibility.
            For a true custom hex we'd add a "+" tile, deferred for now. */}
        <Field label="Color">
          <div
            role="radiogroup"
            aria-label="Brand color"
            className="flex items-center gap-2"
          >
            {COLOR_PRESETS.map((c, i) => {
              const active = draft.color.toLowerCase() === c.toLowerCase();
              const isGradient = i === COLOR_PRESETS.length - 1;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set({ color: c })}
                  title={c}
                  className={[
                    'h-7 w-7 shrink-0 rounded-md transition-transform',
                    active
                      ? 'ring-2 ring-offset-2 ring-offset-bg-surface ring-fg-base scale-105'
                      : 'hover:scale-105',
                  ].join(' ')}
                  style={
                    isGradient
                      ? {
                          background:
                            'linear-gradient(135deg, #FACC15 0%, #16A34A 50%, #1063E8 100%)',
                        }
                      : { background: c }
                  }
                />
              );
            })}
          </div>
        </Field>

        {/* Icon — small preview + Upload button, mirrors the screenshot.
            Preview uses the brand color background with white initials
            when no image is set. A Trash button next to Upload appears
            once a file is picked or already saved. */}
        <Field label="Icon">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-base"
              style={{ background: previewPath ? '#fff' : draft.color }}
            >
              {previewPath ? (
                <img
                  src={localFileUrl(previewPath)}
                  alt=""
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[11px] font-bold text-white">
                  {initialsFor(draft.name)}
                </span>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={() => void pickLogo()}>
              <IconUpload size={13} /> Upload icon…
            </Button>
            {previewPath && (
              <Button size="sm" variant="ghost" onClick={removeLogo}>
                <IconTrash size={13} /> Remove
              </Button>
            )}
          </div>
          <div className="mt-1 text-[10px] text-fg-subtle">
            Optional. A small logo that appears on cards and lists.
          </div>
        </Field>

        {/* Disclosure for the long-tail fields. Folded by default so the
            modal opens compact; expanding reveals the contact / identity
            block. Saved data already on the brand keeps these expanded
            by default in edit mode — so the user sees their values
            without an extra click. */}
        <details
          className="rounded-md border border-border-subtle bg-bg-elevated/40 px-3 py-2"
          open={isEdit && hasAnyDetails(draft)}
        >
          <summary className="cursor-pointer text-xs font-semibold text-fg-base">
            Brand details (optional)
          </summary>
          <div className="mt-3 space-y-3">
            <Field
              label="Tagline"
              hint="One-line description. Used in `tagline` brand-field on labels."
            >
              <TextInput
                value={draft.tagline}
                onChange={(e) => set({ tagline: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Website">
                <TextInput
                  value={draft.website}
                  onChange={(e) => set({ website: e.target.value })}
                  placeholder="https://"
                />
              </Field>
              <Field label="Email">
                <TextInput
                  type="email"
                  value={draft.email}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <TextInput
                  value={draft.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </Field>
              <Field label="Established (year)">
                <TextInput
                  value={draft.establishedYear}
                  onChange={(e) => set({ establishedYear: e.target.value })}
                  placeholder="2020"
                />
              </Field>
            </div>

            <Field label="Address">
              <TextArea
                rows={2}
                value={draft.address}
                onChange={(e) => set({ address: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Category">
                <select
                  value={draft.category ?? 'FMCG'}
                  onChange={(e) => set({ category: e.target.value })}
                  className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Customer care label"
                hint="Heading shown above the contact block on labels."
              >
                <TextInput
                  value={draft.customerCareLabel ?? ''}
                  onChange={(e) => set({ customerCareLabel: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </details>

        {/* Subtle prompt on create: details exist but are folded; no
            pre-save "you didn't fill anything" warning — if users want
            minimal brands, that's their call. */}
        {!isEdit && (
          <div className="text-[10px] text-fg-subtle">
            <IconPhoto size={10} className="-mt-0.5 mr-1 inline" />
            You can add address / phone / website later from this same form.
          </div>
        )}
      </div>
    </Modal>
  );
}

/** True if any of the disclosure-block fields carry data. Used to
 *  default-open the disclosure in edit mode so saved data is visible. */
function hasAnyDetails(d: NewBrandInput): boolean {
  return Boolean(
    d.tagline?.trim() ||
      d.website?.trim() ||
      d.email?.trim() ||
      d.phone?.trim() ||
      d.address?.trim() ||
      d.establishedYear?.trim() ||
      (d.category && d.category !== 'FMCG') ||
      (d.customerCareLabel && d.customerCareLabel !== 'Customer care'),
  );
}
