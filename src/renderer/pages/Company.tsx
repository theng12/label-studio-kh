import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { Field, TextInput, TextArea } from '../components/FormField';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from '../components/Toast';
import { useCompanyStore } from '../stores/companyStore';
import type { Company, CustomField } from '../../shared/types/company';
import {
  DEFAULT_PRICE_GROUPS,
  MAX_CUSTOM_FIELDS,
} from '../../shared/types/company';

// /company — manage the company list, edit fields, set the active one.
// Single page (no separate edit-modal) because companies are few and the
// form is short. The active company is highlighted; clicking another row
// switches active.

export default function CompanyPage() {
  const [params, setParams] = useSearchParams();
  const companies = useCompanyStore((s) => s.companies);
  const activeId = useCompanyStore((s) => s.activeCompanyId);
  const setActive = useCompanyStore((s) => s.setActive);
  const create = useCompanyStore((s) => s.create);
  const update = useCompanyStore((s) => s.update);
  const remove = useCompanyStore((s) => s.remove);
  const refresh = useCompanyStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Edit-form state. selectedId = which company is loaded in the right
  // pane. Picks the active one by default; "new" pre-fills a blank form.
  const [selectedId, setSelectedId] = useState<string | null>(activeId);
  useEffect(() => {
    // If active changes externally (sidebar swap), follow it unless the
    // user is mid-creating a new one.
    if (activeId && selectedId !== 'new' && selectedId !== activeId) {
      setSelectedId(activeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (params.get('new') === '1') {
      setSelectedId('new');
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const selected =
    selectedId === 'new'
      ? null
      : companies.find((c) => c.id === selectedId) ?? null;

  return (
    <Page title="Companies">
      <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-4">
        {/* Left: list of companies */}
        <aside>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
              All companies
            </span>
            <button
              onClick={() => setSelectedId('new')}
              title="New company"
              className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-base"
            >
              <IconPlus size={12} />
            </button>
          </div>
          <div className="rounded-md border border-border-base bg-bg-surface p-1">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={[
                  'flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs transition-colors',
                  c.id === selectedId
                    ? 'bg-bg-hover text-fg-base'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-base',
                ].join(' ')}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded border border-border-base"
                  style={{ background: c.color }}
                />
                <span className="flex-1 truncate font-medium">{c.name}</span>
                {c.id === activeId && (
                  <span className="rounded bg-success/15 px-1 py-0.5 text-[9px] font-medium text-success">
                    active
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Right: edit form */}
        <main className="min-w-0">
          {selectedId === 'new' ? (
            <CompanyEditor
              key="new"
              company={null}
              isActive={false}
              onSaved={async (saved) => {
                setSelectedId(saved.id);
                await setActive(saved.id);
              }}
              onCancel={() => setSelectedId(activeId)}
              onCreate={create}
              onUpdate={update}
              onRemove={remove}
              onMakeActive={setActive}
            />
          ) : selected ? (
            <CompanyEditor
              key={selected.id}
              company={selected}
              isActive={selected.id === activeId}
              onSaved={() => {
                /* stay on the same row */
              }}
              onCancel={() => {
                /* form discards by remount; nothing else to do */
              }}
              onCreate={create}
              onUpdate={update}
              onRemove={remove}
              onMakeActive={setActive}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border-base p-12 text-center text-sm text-fg-muted">
              Pick a company on the left, or create a new one.
            </div>
          )}
        </main>
      </div>
    </Page>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────

interface EditorProps {
  company: Company | null;
  isActive: boolean;
  onSaved: (c: Company) => void | Promise<void>;
  onCancel: () => void;
  onCreate: ReturnType<typeof useCompanyStore.getState>['create'];
  onUpdate: ReturnType<typeof useCompanyStore.getState>['update'];
  onRemove: ReturnType<typeof useCompanyStore.getState>['remove'];
  onMakeActive: (id: string) => Promise<void>;
}

function CompanyEditor({
  company,
  isActive,
  onSaved,
  onCancel,
  onCreate,
  onUpdate,
  onRemove,
  onMakeActive,
}: EditorProps) {
  const [name, setName] = useState(company?.name ?? '');
  const [color, setColor] = useState(company?.color ?? '#3B82F6');
  const [address, setAddress] = useState(company?.address ?? '');
  const [phone, setPhone] = useState(company?.phone ?? '');
  const [email, setEmail] = useState(company?.email ?? '');
  const [website, setWebsite] = useState(company?.website ?? '');
  const [priceGroups, setPriceGroups] = useState<string[]>(
    company?.priceGroups ?? [...DEFAULT_PRICE_GROUPS],
  );
  const [customFields, setCustomFields] = useState<CustomField[]>(
    company?.customFields ?? [],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error('Name is required.');
      return;
    }
    setSaving(true);
    try {
      // Reject blank price-group names; trimming + dedup before save.
      const groups = priceGroups
        .map((g) => g.trim())
        .filter(Boolean)
        .filter((g, i, a) => a.indexOf(g) === i);
      // Same treatment for custom fields — trim, drop blanks, dedup by
      // name (case-insensitive). A duplicate would otherwise collapse to
      // a single input in ProductForm and be a confusing UX.
      const fields = customFields
        .map((f) => ({ name: f.name.trim() }))
        .filter((f) => f.name)
        .filter(
          (f, i, a) =>
            a.findIndex(
              (x) => x.name.toLowerCase() === f.name.toLowerCase(),
            ) === i,
        )
        .slice(0, MAX_CUSTOM_FIELDS);
      const payload = {
        name: name.trim(),
        color,
        address,
        phone,
        email,
        website,
        priceGroups: groups,
        customFields: fields,
      };
      if (company) {
        const updated = await onUpdate(company.id, payload);
        if (updated) {
          toast.success('Company saved.');
          await onSaved(updated);
        }
      } else {
        const created = await onCreate(payload);
        await onSaved(created);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border-base bg-bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="h-8 w-8 shrink-0 rounded border border-border-base"
            style={{ background: color }}
          />
          <h2 className="text-base font-semibold text-fg-base">
            {company ? `Edit ${company.name}` : 'New company'}
          </h2>
          {company && !isActive && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void onMakeActive(company.id)}
              className="ml-auto"
            >
              Set as active
            </Button>
          )}
          {isActive && (
            <span className="ml-auto rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
              Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Company name *">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Trading Co."
            />
          </Field>
          <Field label="Color" hint="Swatch shown in the workspace switcher.">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-full cursor-pointer rounded border border-border-base bg-bg-surface"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Address">
            <TextArea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Phone">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email">
            <TextInput
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
          </Field>
          <Field label="Website">
            <TextInput
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
            />
          </Field>
        </div>

        {/* Price groups */}
        <div className="mt-5">
          <div className="mb-1 flex items-baseline justify-between">
            <div className="text-xs font-semibold uppercase tracking-widest text-fg-subtle">
              Price groups
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPriceGroups([...priceGroups, ''])}
            >
              <IconPlus size={11} /> Add group
            </Button>
          </div>
          <div className="text-[10px] text-fg-subtle">
            One numeric input appears per group on the product form. Examples:
            Retail, Wholesale, VIP, Distributor.
          </div>
          <div className="mt-2 space-y-1.5">
            {priceGroups.map((g, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={g}
                  onChange={(e) => {
                    const next = [...priceGroups];
                    next[i] = e.target.value;
                    setPriceGroups(next);
                  }}
                  placeholder="Group name"
                  className="flex-1 rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() =>
                    setPriceGroups(priceGroups.filter((_, idx) => idx !== i))
                  }
                  title="Remove this price group"
                  className="rounded p-1.5 text-fg-muted hover:bg-bg-hover hover:text-danger"
                >
                  <IconX size={13} />
                </button>
              </div>
            ))}
            {priceGroups.length === 0 && (
              <div className="rounded-md border border-dashed border-border-base px-3 py-2 text-xs text-fg-subtle">
                No price groups — products won't show a Prices section until
                you add at least one.
              </div>
            )}
          </div>
        </div>

        {/* Custom product fields — definitions live on the Company so the
            same field names appear on every product in this workspace.
            ProductForm reads `activeCompany.customFields` and renders one
            free-text input per definition. Capped at MAX_CUSTOM_FIELDS so
            the form doesn't sprawl. */}
        <div className="mt-5">
          <div className="mb-1 flex items-baseline justify-between">
            <div className="text-xs font-semibold uppercase tracking-widest text-fg-subtle">
              Custom product fields
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setCustomFields([...customFields, { name: '' }])
              }
              disabled={customFields.length >= MAX_CUSTOM_FIELDS}
              title={
                customFields.length >= MAX_CUSTOM_FIELDS
                  ? `Maximum of ${MAX_CUSTOM_FIELDS} fields per company`
                  : 'Add a custom field'
              }
            >
              <IconPlus size={11} /> Add field
            </Button>
          </div>
          <div className="text-[10px] text-fg-subtle">
            Up to {MAX_CUSTOM_FIELDS} free-text fields available on every
            product. {customFields.length} / {MAX_CUSTOM_FIELDS}.
          </div>
          <div className="mt-2 space-y-1.5">
            {customFields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={f.name}
                  onChange={(e) => {
                    const next = [...customFields];
                    next[i] = { ...next[i]!, name: e.target.value };
                    setCustomFields(next);
                  }}
                  placeholder="Field name (e.g. Material, Origin, Warranty)"
                  className="flex-1 rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() =>
                    setCustomFields(
                      customFields.filter((_, idx) => idx !== i),
                    )
                  }
                  title="Remove this field"
                  className="rounded p-1.5 text-fg-muted hover:bg-bg-hover hover:text-danger"
                >
                  <IconX size={13} />
                </button>
              </div>
            ))}
            {customFields.length === 0 && (
              <div className="rounded-md border border-dashed border-border-base px-3 py-2 text-xs text-fg-subtle">
                No custom fields yet. Add one to extend the product form.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-border-subtle pt-3">
          <div>
            {company && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
              >
                <IconTrash size={12} /> Delete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void save()}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Saving…' : company ? 'Save changes' : 'Create company'}
            </Button>
          </div>
        </div>
      </div>

      {company && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete ${company.name}?`}
          message={
            <>
              Removes this company permanently. Brands and products
              previously assigned to it will be <strong>orphaned</strong> —
              they stay in the database but won't show up under any company.
              Move them to another company first if you want to keep them.
              <br />
              <br />
              This cannot be undone.
            </>
          }
          confirmLabel="Delete company"
          cancelLabel="Keep it"
          tone="danger"
          onConfirm={async () => {
            setConfirmDelete(false);
            await onRemove(company.id);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
