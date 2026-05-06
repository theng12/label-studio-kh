import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

const inputClass =
  'w-full rounded-md border border-border-base bg-bg-surface px-3 py-2 text-sm text-fg-base placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-fg-subtle">{hint}</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[inputClass, props.className ?? ''].join(' ')} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[inputClass, 'resize-y min-h-[72px]', props.className ?? ''].join(' ')}
    />
  );
}

export function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded border border-border-base bg-bg-surface"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[inputClass, 'flex-1'].join(' ')}
      />
    </div>
  );
}
