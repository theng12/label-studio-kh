import { useEffect, useMemo, useRef } from 'react';
import { IconSparkles, IconX } from '@tabler/icons-react';
import { Button } from './Button';
// CHANGELOG.md lives at the project root; Vite's ?raw suffix inlines its full
// text into the bundle at build time, so the in-app changelog stays in sync
// with the file we already maintain. No runtime fetch, no separate JSON.
import changelogRaw from '../../../CHANGELOG.md?raw';

export interface ChangelogEntry {
  version: string;
  date: string | null;
  sections: Array<{
    title: string;
    items: string[];
  }>;
}

/**
 * Parse our CHANGELOG.md into structured entries. The format is
 * Keep-a-Changelog with `## [vX.Y.Z] — DATE` version headers and
 * `### Section` subheaders followed by `- bullet` items. Bullet items
 * can wrap across multiple lines (indented continuation), which the
 * parser flattens by joining on whitespace.
 *
 * Bold emphasis (`**...**`) inside bullets is preserved as a marker for
 * the renderer to style; everything else stays plain text.
 */
export function parseChangelog(raw: string): ChangelogEntry[] {
  const lines = raw.split(/\r?\n/);
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  let currentSection: ChangelogEntry['sections'][number] | null = null;
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (currentSection && buffer.length > 0) {
      currentSection.items.push(buffer.join(' ').replace(/\s+/g, ' ').trim());
    }
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Version header: "## [0.2.4] — 2026-05-11" or "## [0.2.4]"
    const verMatch = /^##\s+\[([^\]]+)\](?:\s*[—-]\s*(.+))?$/.exec(line);
    if (verMatch) {
      flushBuffer();
      currentSection = null;
      current = {
        version: verMatch[1] ?? 'unknown',
        date: (verMatch[2] ?? '').trim() || null,
        sections: [],
      };
      entries.push(current);
      continue;
    }
    if (!current) continue;

    // Section header: "### Added"
    const secMatch = /^###\s+(.+?)\s*$/.exec(line);
    if (secMatch) {
      flushBuffer();
      currentSection = { title: secMatch[1] ?? '', items: [] };
      current.sections.push(currentSection);
      continue;
    }

    // Bullet start: "- something"
    if (/^-\s+/.test(line)) {
      flushBuffer();
      buffer.push(line.replace(/^-\s+/, ''));
      continue;
    }

    // Continuation (indented or empty after a bullet)
    if (buffer.length > 0 && /^\s+/.test(rawLine)) {
      buffer.push(line.trim());
      continue;
    }

    // Blank line between bullets — flush the current bullet
    if (line === '' && buffer.length > 0) {
      flushBuffer();
    }
  }
  flushBuffer();

  return entries;
}

// Render bold spans inside a bullet. Cheap inline parser — supports only
// **bold**. Anything else is rendered as plain text. Keeps the dependency
// surface tiny vs. pulling in a real markdown lib.
function BulletText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-fg-base">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Only show entries newer than this version. If null, show all parsed. */
  sinceVersion?: string | null;
  /** Max entries to render (default 6). */
  limit?: number;
}

export function WhatsNewModal({ open, onClose, sinceVersion, limit = 6 }: Props) {
  const allEntries = useMemo(() => parseChangelog(changelogRaw), []);
  const entries = useMemo(() => {
    let list = allEntries;
    if (sinceVersion) {
      // Show every entry up to (but not including) the version the user has
      // already seen. We compare by string-equality on the version label
      // since CHANGELOG ordering is reliable (newest first).
      const seenIdx = list.findIndex((e) => e.version === sinceVersion);
      if (seenIdx > 0) list = list.slice(0, seenIdx);
      else if (seenIdx === 0) list = []; // nothing newer
    }
    return list.slice(0, limit);
  }, [allEntries, sinceVersion, limit]);

  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-lg border border-border-base bg-bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-3">
          <div className="flex items-center gap-2">
            <IconSparkles size={18} className="text-accent" />
            <h3 id="whatsnew-title" className="text-sm font-semibold text-fg-base">
              What's new
            </h3>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-base"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="scrollbar-thin max-h-[60vh] overflow-y-auto px-5 py-4">
          {entries.length === 0 ? (
            <div className="py-8 text-center text-sm text-fg-muted">
              You're already on the latest. Check back after the next update.
            </div>
          ) : (
            <div className="space-y-6">
              {entries.map((e) => (
                <div key={e.version}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm font-semibold text-fg-base">
                      v{e.version}
                    </span>
                    {e.date && (
                      <span className="text-[10px] text-fg-subtle">{e.date}</span>
                    )}
                  </div>
                  {e.sections.length === 0 ? (
                    <p className="mt-1 text-xs text-fg-muted">(no notes)</p>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {e.sections.map((sec, si) => (
                        <div key={si}>
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
                            {sec.title}
                          </div>
                          <ul className="mt-1 space-y-1.5 pl-1 text-xs text-fg-muted">
                            {sec.items.map((it, ii) => (
                              <li key={ii} className="flex gap-2">
                                <span aria-hidden className="select-none text-fg-subtle">
                                  •
                                </span>
                                <span>
                                  <BulletText text={it} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle px-5 py-3">
          <span className="text-[10px] text-fg-subtle">
            Full history in <code className="rounded bg-bg-elevated px-1 py-px">CHANGELOG.md</code>
          </span>
          <Button size="sm" variant="primary" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
