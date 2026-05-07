import { useEffect, useState } from 'react';

export function ImportHistory() {
  const [imports, setImports] = useState<
    Awaited<ReturnType<typeof window.api.import.listImports>>
  >([]);

  useEffect(() => {
    window.api.import.listImports().then(setImports);
  }, []);

  if (imports.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
        No imports yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-base">
      <table className="w-full text-xs">
        <thead className="bg-bg-elevated text-fg-muted">
          <tr>
            <th className="px-2 py-1.5 text-left">Date</th>
            <th className="px-2 py-1.5 text-left">File</th>
            <th className="px-2 py-1.5 text-left">Brand ID</th>
            <th className="px-2 py-1.5 text-right">Rows</th>
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
