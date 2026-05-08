import { type TemplateElement } from '../../../shared/types/template';
import { Field, ColorInput } from '../../components/FormField';

export function RectProperties({
  element,
  onPatch,
  onCommit,
}: {
  element: Extract<TemplateElement, { type: 'rect' }>;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  return (
    <>
      <Field label="Fill">
        <ColorInput
          value={element.fillColor}
          onChange={(v) => {
            onPatch({ fillColor: v } as Partial<TemplateElement>);
            onCommit();
          }}
        />
      </Field>
      <Field label="Border">
        <ColorInput
          value={element.borderColor}
          onChange={(v) => {
            onPatch({ borderColor: v } as Partial<TemplateElement>);
            onCommit();
          }}
        />
      </Field>
    </>
  );
}
