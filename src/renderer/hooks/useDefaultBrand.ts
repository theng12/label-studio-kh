import { useMemo } from 'react';
import type { Brand } from '../../shared/types/brand';
import { useBrandStore } from '../stores/brandStore';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Resolve which brand a page should default-select. Order of preference:
 * 1. The user's last explicitly-picked brand (settings.lastUsedBrandId), if it
 *    still exists.
 * 2. The first non-demo brand. Demo brand is alphabetically first ("Demo
 *    brand"), so without this, brand-scoped pages always opened against the
 *    demo brand on first launch.
 * 3. The first brand of any kind (only the demo brand may exist on first run).
 *
 * Also returns a `pickBrand(id)` helper that pages can call when the user
 * changes the brand selector — it persists the choice so the next launch
 * remembers it.
 */
export function useDefaultBrand(): {
  brands: Brand[];
  /** Brands the user should see in pickers — filtered by `hideDemoBrand`. */
  visibleBrands: Brand[];
  defaultBrandId: string | null;
  pickBrand: (id: string) => void;
} {
  const brands = useBrandStore((s) => s.brands);
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.set);

  const visibleBrands = useMemo(
    () => (settings?.hideDemoBrand ? brands.filter((b) => !b.isDemo) : brands),
    [brands, settings?.hideDemoBrand],
  );

  const defaultBrandId = useMemo(() => {
    if (visibleBrands.length === 0) return null;
    const last = settings?.lastUsedBrandId;
    if (last && visibleBrands.some((b) => b.id === last)) return last;
    const nonDemo = visibleBrands.find((b) => !b.isDemo);
    if (nonDemo) return nonDemo.id;
    return visibleBrands[0]!.id;
  }, [visibleBrands, settings?.lastUsedBrandId]);

  const pickBrand = (id: string) => {
    void setSettings({ lastUsedBrandId: id });
  };

  return { brands, visibleBrands, defaultBrandId, pickBrand };
}
