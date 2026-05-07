// Curated list of fonts: bundled NotoSans family + system fonts that exist on
// most macOS / Windows / Linux installs. The picker is a combobox — users can
// pick from the list or type any font name. Names are case-sensitive in
// font-family, so we keep the labels exactly as the OS installs them.
//
// At export time, the bundled NotoSans variants are guaranteed (they ship in
// the .dmg). System fonts only render correctly on machines where they're
// installed; for cross-machine consistency, prefer NotoSans.

interface FontGroup {
  label: string;
  fonts: string[];
}

const FONT_GROUPS: FontGroup[] = [
  {
    label: 'Bundled (cross-platform)',
    fonts: [
      'NotoSans',
      'NotoSansKhmer',
      'NotoSansThai',
      'NotoSansKR',
      'NotoSansSC',
      'NotoSansJP',
    ],
  },
  {
    label: 'System default',
    fonts: ['system-ui'],
  },
  {
    label: 'Sans-serif',
    fonts: [
      'Arial',
      'Helvetica',
      'Helvetica Neue',
      'Inter',
      'Roboto',
      'Segoe UI',
      'Tahoma',
      'Trebuchet MS',
      'Verdana',
      'Geneva',
      'Avenir',
      'Avenir Next',
      'SF Pro Display',
      'SF Pro Text',
    ],
  },
  {
    label: 'Serif',
    fonts: [
      'Times New Roman',
      'Times',
      'Georgia',
      'Palatino',
      'Garamond',
      'Cambria',
      'Baskerville',
      'Didot',
    ],
  },
  {
    label: 'Display & decorative',
    fonts: [
      'Impact',
      'Comic Sans MS',
      'Lucida Grande',
      'Marker Felt',
      'Chalkboard',
    ],
  },
  {
    label: 'Monospace',
    fonts: [
      'Courier New',
      'Courier',
      'Menlo',
      'Monaco',
      'Consolas',
      'JetBrains Mono',
      'Fira Code',
    ],
  },
];

const ALL_FONTS = FONT_GROUPS.flatMap((g) => g.fonts);

export function FontPicker({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
}) {
  const isInList = ALL_FONTS.includes(value);
  return (
    <div className="space-y-1">
      <select
        value={isInList ? value : '__custom__'}
        onChange={(e) => {
          if (e.target.value === '__custom__') return;
          onChange(e.target.value);
          onCommit?.();
        }}
        className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        style={{ fontFamily: isInList ? `"${value}", sans-serif` : undefined }}
      >
        {FONT_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.fonts.map((f) => (
              <option key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>
                {f}
              </option>
            ))}
          </optgroup>
        ))}
        <optgroup label="Other">
          <option value="__custom__">Custom (type below)…</option>
        </optgroup>
      </select>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        placeholder="Or type any font installed on your computer"
        className="w-full rounded-md border border-border-base bg-bg-base px-2 py-1.5 text-xs font-mono"
        style={{ fontFamily: `"${value}", sans-serif` }}
      />
    </div>
  );
}
