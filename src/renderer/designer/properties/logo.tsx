import { type TemplateElement } from '../../../shared/types/template';
import { Field } from '../../components/FormField';
import { useDesignerStore } from '../../stores/designerStore';
import { useBrandStore } from '../../stores/brandStore';

export function LogoProperties({
  element,
  onPatch,
  onCommit,
}: {
  element: Extract<TemplateElement, { type: 'logo' }>;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  const template = useDesignerStore((s) => s.template);
  const brand = useBrandStore((s) =>
    template ? (s.brands.find((b) => b.id === template.brandId) ?? null) : null,
  );

  const logos = brand?.logos ?? [];
  const effectiveId =
    element.logoId && logos.find((l) => l.id === element.logoId)
      ? element.logoId
      : (logos[0]?.id ?? '');

  return (
    <>
      <Field
        label="Which logo"
        hint={
          logos.length === 0
            ? 'This brand has no logo files yet — add some on the brand edit page.'
            : 'Pick which of this brand’s logo variants to display here.'
        }
      >
        <select
          value={effectiveId}
          disabled={logos.length === 0}
          onChange={(e) => {
            const id = e.target.value;
            // When the user picks the brand's first logo (the default), store
            // undefined so future changes to the brand's primary still flow
            // through. Otherwise store the explicit id.
            onPatch({
              logoId: id && id !== logos[0]?.id ? id : undefined,
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          {logos.length === 0 && <option value="">— no logos —</option>}
          {logos.map((l, i) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {i === 0 ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Object fit" hint="How the logo scales inside its box">
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
