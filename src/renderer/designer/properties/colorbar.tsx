import { type TemplateElement } from '../../../shared/types/template';
import { Field, ColorInput } from '../../components/FormField';

export function ColorbarProperties({
  element,
  onPatch,
  onCommit,
}: {
  element: Extract<TemplateElement, { type: 'colorbar' }>;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  return (
    <Field label="Color">
      <ColorInput
        value={element.color}
        onChange={(v) => {
          onPatch({ color: v } as Partial<TemplateElement>);
          onCommit();
        }}
      />
    </Field>
  );
}
