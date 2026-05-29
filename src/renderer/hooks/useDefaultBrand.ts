import { useMemo } from 'react';
import type { Brand } from '../../shared/types/brand';
import { useBrandStore } from '../stores/brandStore';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Resolve which brand a page should default-select. Order of preference:
 * 1. The user's last explicitly-picked brand (settings.lastUsedBrandId), if it
 *    still exists.
 * 2. The first brand in the list.
 *
 * Also returns a `pickBrand(id)` helper that pages can call when the user
 * changes the brand selector — it persists the choice so the next launch
 * remembers it.
 *
 * `visibleBrands` is kept as a separate field for callers that historically
 * worked off a filtered view (it used to drop the demo brand). The demo
 * concept has been removed, so the two arrays are identical now; callers
 * may use whichever reads more clearly.
 */
export function useDefaultBrand(): {
  brands: Brand[];
  visibleBrands: Brand[];
  defaultBrandId: string | null;
  pickBrand: (id: string) => void;
} {
  const brands = useBrandStore((s) => s.brands);
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.set);

  const defaultBrandId = useMemo(() => {
    if (brands.length === 0) return null;
    const last = settings?.lastUsedBrandId;
    if (last && brands.some((b) => b.id === last)) return last;
    return brands[0]!.id;
  }, [brands, settings?.lastUsedBrandId]);

  const pickBrand = (id: string) => {
    void setSettings({ lastUsedBrandId: id });
  };

  return { brands, visibleBrands: brands, defaultBrandId, pickBrand };
}
