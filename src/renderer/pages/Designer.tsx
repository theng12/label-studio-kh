import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { Canvas } from '../designer/Canvas';
import { Palette } from '../designer/Palette';
import { Layers } from '../designer/Layers';
import { Properties } from '../designer/Properties';
import { TopBar } from '../designer/TopBar';
import { BottomBar } from '../designer/BottomBar';
import { AlignmentToolbar } from '../designer/AlignmentToolbar';
import { useDesignerStore } from '../stores/designerStore';
import { useBrandStore } from '../stores/brandStore';
import { toast } from '../components/Toast';
import type { Template, NewTemplateInput } from '../../shared/types/template';

function blankTemplate(brandId: string): NewTemplateInput {
  return {
    brandId,
    name: 'Untitled template',
    orientation: 'portrait',
    width_mm: 50,
    height_mm: 70,
    background: '#FFFFFF',
    elements: [],
  };
}

export default function Designer() {
  const { brandId, templateId } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get('new') === '1' || templateId === 'new';
  const navigate = useNavigate();

  const setTemplate = useDesignerStore((s) => s.setTemplate);
  const markSaved = useDesignerStore((s) => s.markSaved);
  const template = useDesignerStore((s) => s.template);
  const refreshBrands = useBrandStore((s) => s.refresh);
  const brands = useBrandStore((s) => s.brands);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void refreshBrands();
  }, [refreshBrands]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!brandId) {
        setMissing(true);
        setLoading(false);
        return;
      }

      if (isNew) {
        const blank = blankTemplate(brandId) as Template;
        if (!cancelled)
          setTemplate({
            ...blank,
            id: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        setLoading(false);
        return;
      }

      if (!templateId) {
        setMissing(true);
        setLoading(false);
        return;
      }

      const loaded = await window.api.template.get(brandId, templateId);
      if (cancelled) return;
      if (!loaded) {
        setMissing(true);
      } else {
        setTemplate(loaded);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [brandId, templateId, isNew, setTemplate]);

  const onSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      const saved = await window.api.template.save(template);
      // markSaved keeps the in-flight edits/history intact and just notes that
      // disk is now in sync — Save button greys out, "saved Xs ago" timer
      // resets — without throwing away the user's history stack.
      markSaved(saved);
      // If this was a new template, replace the URL with the real id.
      if (isNew) {
        navigate(`/designer/${saved.brandId}/${saved.id}`, { replace: true });
      }
    } catch (err) {
      toast.error(`Couldn't save template: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // Cmd/Ctrl+S triggers the same save action as the TopBar button. Held in a
  // ref so the listener stays stable across renders without restarting on
  // every state change. Mounted only while the Designer page is, so the
  // shortcut doesn't fire on other pages.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      void saveRef.current();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ⌘G / ⌘⇧G / ⌘C / ⌘V — page-level so they fire from anywhere in the
  // designer (canvas, layers, palette) but not while typing in property
  // inputs, where the OS-native copy/paste is what the user expects.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      if (
        t?.tagName === 'INPUT' ||
        t?.tagName === 'TEXTAREA' ||
        t?.isContentEditable
      )
        return;

      const key = e.key.toLowerCase();
      const store = useDesignerStore.getState();

      if (key === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          // Ungroup every distinct group represented in the current selection.
          const tpl = store.template;
          if (!tpl) return;
          const gids = new Set<string>();
          for (const id of store.selectedIds) {
            const el = tpl.elements.find((x) => x.id === id);
            if (el?.groupId) gids.add(el.groupId);
          }
          gids.forEach((g) => store.ungroup(g));
        } else {
          store.groupSelected();
        }
        return;
      }
      if (key === 'c') {
        // Skip when there's an active text selection — user is copying text.
        const sel = window.getSelection?.();
        if (sel && sel.toString().length > 0) return;
        if (store.selectedIds.length === 0) return;
        e.preventDefault();
        store.copySelected();
        return;
      }
      if (key === 'v') {
        if (!store.template) return;
        if (!store.clipboard || store.clipboard.length === 0) return;
        e.preventDefault();
        store.paste();
        return;
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loading) {
    return (
      <Page title="Template designer">
        <div className="text-sm text-fg-muted">Loading…</div>
      </Page>
    );
  }

  if (missing || !template) {
    return (
      <Page title="Template designer">
        <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
          <h3 className="text-sm font-semibold text-fg-base">Template not found</h3>
          <p className="mt-1 text-xs text-fg-muted">
            The brand or template you tried to open doesn't exist.
          </p>
          <div className="mt-4 inline-block">
            <Button variant="secondary" onClick={() => navigate('/brands')}>
              Back to brands
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  if (brands.length === 0) {
    // brands not loaded yet but template is — still fine to show
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar onSave={onSave} saving={saving} />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 flex-col border-r border-border-base bg-bg-surface">
          <Palette />
          <Layers />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <Canvas />
            <AlignmentToolbar />
          </div>
          <BottomBar />
        </div>

        <aside className="w-72 overflow-y-auto border-l border-border-base bg-bg-surface">
          <Properties />
        </aside>
      </div>
    </div>
  );
}
