import { useEffect, useState } from 'react';
import { Page } from '../components/Page';
import { useBrandStore } from '../stores/brandStore';
import { useImportStore } from '../stores/importStore';
import { ImportFlow } from './dataImport/ImportFlow';
import { ManualEntry } from './dataImport/ManualEntry';
import { SkuLookup } from './dataImport/SkuLookup';
import { ImportHistory } from './dataImport/ImportHistory';

type DataTab = 'import' | 'manual' | 'lookup' | 'history';

export default function DataImport() {
  const { brands, refresh } = useBrandStore();
  const im = useImportStore();
  const [tab, setTab] = useState<DataTab>('import');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!im.brandId && brands.length > 0) im.setBrandId(brands[0]!.id);
  }, [brands, im]);

  return (
    <Page title="Data & Import">
      <div className="mb-4 flex gap-1 border-b border-border-base">
        <TabBtn active={tab === 'import'} onClick={() => setTab('import')}>
          Import
        </TabBtn>
        <TabBtn active={tab === 'manual'} onClick={() => setTab('manual')}>
          Manual entry
        </TabBtn>
        <TabBtn active={tab === 'lookup'} onClick={() => setTab('lookup')}>
          SKU lookup
        </TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>
          Import history
        </TabBtn>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-base p-12 text-center text-sm text-fg-muted">
          Create a brand first on the Brands page.
        </div>
      ) : tab === 'import' ? (
        <ImportFlow />
      ) : tab === 'manual' ? (
        <ManualEntry />
      ) : tab === 'lookup' ? (
        <SkuLookup />
      ) : (
        <ImportHistory />
      )}
    </Page>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-2 text-sm transition-colors -mb-px border-b-2',
        active
          ? 'border-accent text-fg-base'
          : 'border-transparent text-fg-muted hover:text-fg-base',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
