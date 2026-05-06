import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconPlus } from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useBrandStore } from '../stores/brandStore';
import type { Template } from '../../shared/types/template';

export default function Templates() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { brands, refresh } = useBrandStore();
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(
    params.get('brand'),
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedBrandId && brands.length > 0) {
      setSelectedBrandId(brands[0]!.id);
    }
  }, [brands, selectedBrandId]);

  useEffect(() => {
    if (!selectedBrandId) return;
    setLoading(true);
    window.api.template.listForBrand(selectedBrandId).then((list) => {
      setTemplates(list);
      setLoading(false);
    });
  }, [selectedBrandId]);

  // Auto-open new-template flow if redirected here from the brand wizard
  useEffect(() => {
    const wantNew = params.get('new') === '1';
    if (wantNew && selectedBrandId) {
      navigate(`/designer/${selectedBrandId}/new`, { replace: true });
    }
  }, [params, selectedBrandId, navigate]);

  if (brands.length === 0) {
    return (
      <Page title="Templates">
        <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
          <h3 className="text-sm font-semibold text-fg-base">Create a brand first</h3>
          <p className="mt-1 text-xs text-fg-muted">
            Templates belong to brands. Create a brand on the Brands page to get started.
          </p>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Templates"
      actions={
        <Button
          variant="primary"
          onClick={() =>
            selectedBrandId && navigate(`/designer/${selectedBrandId}/new`)
          }
        >
          <IconPlus size={14} /> New template
        </Button>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-fg-muted">Brand</span>
        <select
          value={selectedBrandId ?? ''}
          onChange={(e) => setSelectedBrandId(e.target.value)}
          className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm text-fg-base"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-fg-muted">Loading…</div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
          <h3 className="text-sm font-semibold text-fg-base">No templates yet</h3>
          <p className="mt-1 text-xs text-fg-muted">
            Click "New template" to start designing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() =>
                selectedBrandId &&
                navigate(`/designer/${selectedBrandId}/${t.id}`)
              }
              className="rounded-lg border border-border-base bg-bg-surface p-4 text-left transition-colors hover:bg-bg-hover"
            >
              <div className="text-sm font-semibold text-fg-base">{t.name}</div>
              <div className="mt-1 text-xs text-fg-muted">
                {t.width_mm}×{t.height_mm} mm · {t.orientation}
              </div>
              <div className="mt-2 text-xs text-fg-subtle">
                {t.elements.length} element{t.elements.length === 1 ? '' : 's'}
              </div>
            </button>
          ))}
        </div>
      )}
    </Page>
  );
}
