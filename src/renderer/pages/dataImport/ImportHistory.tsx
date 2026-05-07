import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function ImportHistory() {
  const { t } = useTranslation();
  const [imports, setImports] = useState<
    Awaited<ReturnType<typeof window.api.import.listImports>>
  >([]);

  useEffect(() => {
    window.api.import.listImports().then(setImports);
  }, []);

  if (imports.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
        {t('dataImport.history.empty')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-base">
      <table className="w-full text-xs">
        <thead className="bg-bg-elevated text-fg-muted">
          <tr>
            <th className="px-2 py-1.5 text-left">{t('dataImport.history.table.date')}</th>
            <th className="px-2 py-1.5 text-left">{t('dataImport.history.table.file')}</th>
            <th className="px-2 py-1.5 text-left">{t('dataImport.history.table.brandId')}</th>
            <th className="px-2 py-1.5 text-right">{t('dataImport.history.table.rows')}</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((i) => (
            <tr key={i.id}>
              <td className="border-b border-border-subtle px-2 py-1.5">
                {new Date(i.created_at).toLocaleString()}
              </td>
              <td className="border-b border-border-subtle px-2 py-1.5">
                {i.source_filename ?? '—'}
              </td>
              <td className="border-b border-border-subtle px-2 py-1.5 font-mono text-fg-subtle">
                {i.brand_id ?? '—'}
              </td>
              <td className="border-b border-border-subtle px-2 py-1.5 text-right">
                {i.row_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
