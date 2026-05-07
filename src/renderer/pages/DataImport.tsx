import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Page } from '../components/Page';
import { useBrandStore } from '../stores/brandStore';
import { useImportStore } from '../stores/importStore';
import { ImportFlow } from './dataImport/ImportFlow';
import { ManualEntry } from './dataImport/ManualEntry';
import { SkuLookup } from './dataImport/SkuLookup';
import { ImportHistory } from './dataImport/ImportHistory';

type DataTab = 'import' | 'manual' | 'lookup' | 'history';

export default function DataImport() {
  const { t } = useTranslation();
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
    <Page title={t('dataImport.title')}>
      <div className="mb-4 flex gap-1 border-b border-border-base">
        <TabBtn active={tab === 'import'} onClick={() => setTab('import')}>
          {t('dataImport.tabs.import')}
        </TabBtn>
        <TabBtn active={tab === 'manual'} onClick={() => setTab('manual')}>
          {t('dataImport.tabs.manual')}
        </TabBtn>
        <TabBtn active={tab === 'lookup'} onClick={() => setTab('lookup')}>
          {t('dataImport.tabs.lookup')}
        </TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>
          {t('dataImport.tabs.history')}
        </TabBtn>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-base p-12 text-center text-sm text-fg-muted">
          {t('dataImport.noBrand')}
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
