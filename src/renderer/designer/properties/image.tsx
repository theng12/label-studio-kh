import { type TemplateElement } from '../../../shared/types/template';
import { Field } from '../../components/FormField';

export function ImageProperties({
  element,
  onPatch,
  onCommit,
}: {
  element: Extract<TemplateElement, { type: 'image' }>;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  return (
    <>
      <Field label="Source">
        <select
          value={element.dataSource}
          onChange={(e) => {
            onPatch({
              dataSource: e.target.value as
                | 'static_asset'
                | 'csv_column_path',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="csv_column_path">From CSV column</option>
          <option value="static_asset">Static file</option>
        </select>
      </Field>
      {element.dataSource === 'csv_column_path' ? (
        <Field
          label="CSV column"
          hint="The column should contain a file path on disk OR a URL (https://…). Both work."
        >
          <input
            value={element.csvColumn}
            onChange={(e) =>
              onPatch({
                csvColumn: e.target.value,
              } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
            placeholder="product_image_path"
          />
        </Field>
      ) : (
        <Field
          label="File path"
          hint="Absolute path on disk, or a URL. Use the Pick button to browse."
        >
          <div className="flex gap-2">
            <input
              value={element.assetPath}
              onChange={(e) =>
                onPatch({
                  assetPath: e.target.value,
                } as Partial<TemplateElement>)
              }
              onBlur={onCommit}
              className="flex-1 rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              placeholder="/path/to/image.png"
            />
            <button
              onClick={async () => {
                const path = await window.api.dialog.pickImage();
                if (path) {
                  onPatch({
                    assetPath: path,
                  } as Partial<TemplateElement>);
                  onCommit();
                }
              }}
              className="rounded-md border border-border-base bg-bg-elevated px-2 text-xs text-fg-base hover:bg-bg-hover"
            >
              Pick…
            </button>
          </div>
        </Field>
      )}
      <Field label="Object fit" hint="How the image scales inside the box">
        <select
          value={element.objectFit}
          onChange={(e) => {
            onPatch({
              objectFit: e.target.value as 'contain' | 'cover' | 'fill',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="contain">Contain (no crop)</option>
          <option value="cover">Cover (crop to fill)</option>
          <option value="fill">Fill (stretch)</option>
        </select>
      </Field>
    </>
  );
}
