import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconLayoutDashboard,
  IconBuildingStore,
  IconBuilding,
  IconTemplate,
  IconPackage,
  IconWand,
  IconFiles,
  IconBarcode,
  IconSettings,
  IconHistory,
  IconHeart,
  IconSparkles,
  IconListCheck,
  type Icon,
} from '@tabler/icons-react';
import { WhatsNewModal } from './WhatsNew';
import { CompanySwitcher } from './CompanySwitcher';
import { useJobsStore } from '../stores/jobsStore';

// localStorage key for tracking which version the user has already seen the
// What's New panel for. When the running version differs from the stored
// one, the modal auto-opens on launch so users don't miss new features.
const WHATSNEW_LAST_SEEN_KEY = 'lskh.whatsnew.lastSeenVersion';

interface NavItem {
  to: string;
  label: string;
  icon: Icon;
  badge?: string;
}

interface NavSection {
  heading?: string;
  items: NavItem[];
}

export function Sidebar() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>('');
  const [isDev, setIsDev] = useState<boolean>(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  // Subscribe to the in-memory jobs store so the "Jobs" nav row shows a
  // live count badge and the footer chip pulses while anything is running.
  const runningCount = useJobsStore((s) =>
    Object.values(s.jobs).filter((j) => j.status === 'running').length,
  );
  // Tracks what was already seen at the time we opened the modal so the
  // diff-view ("only things newer than v0.2.3") is correct even after the
  // user dismisses the modal and reopens manually within the same session.
  const [seenVersion, setSeenVersion] = useState<string | null>(null);

  useEffect(() => {
    void window.api.app.getInfo().then((info) => {
      setVersion(info.version);
      setIsDev(info.isDev);

      // Auto-open What's New on the first launch of a newer build. Skip in
      // dev so it doesn't pop on every hot-reload. Compare exact-string —
      // the format is "X.Y.Z" and the parser uses the same key.
      if (!info.isDev) {
        const last = localStorage.getItem(WHATSNEW_LAST_SEEN_KEY);
        if (last !== info.version) {
          setSeenVersion(last); // null on first ever run → show everything
          setWhatsNewOpen(true);
        }
      }
    });
  }, []);

  const closeWhatsNew = () => {
    setWhatsNewOpen(false);
    if (version) localStorage.setItem(WHATSNEW_LAST_SEEN_KEY, version);
  };
  const openWhatsNew = () => {
    // Manual open: show the FULL history. The user is explicitly asking
    // to see what changed, so we don't gate by last-seen — that gating is
    // only useful for the auto-open path (which surfaces just the new
    // entries on a fresh launch after an update).
    setSeenVersion(null);
    setWhatsNewOpen(true);
  };

  const sections: NavSection[] = [
    {
      items: [
        // Company first — it's the broadest scope (the workspace itself),
        // and the user thinks "which workspace am I in?" before "what's
        // happening in it?". Dashboard sits one rung down as the in-
        // workspace overview. Brands rounds out the SETUP group.
        { to: '/company', label: 'Company', icon: IconBuilding },
        { to: '/', label: t('nav.dashboard'), icon: IconLayoutDashboard },
        { to: '/brands', label: t('nav.brands'), icon: IconBuildingStore },
      ],
    },
    {
      heading: t('nav.production'),
      items: [
        // Product Library houses Import + History as tabs now, so the
        // standalone "Data & Import" nav item is gone. The /data route
        // still works for old bookmarks.
        { to: '/products', label: 'Product Library', icon: IconPackage },
        { to: '/templates', label: t('nav.templates'), icon: IconTemplate },
        { to: '/generate', label: t('nav.generate'), icon: IconWand },
        {
          to: '/jobs',
          label: 'Jobs',
          icon: IconListCheck,
          // Live running-count badge — only visible while something's
          // actually running, otherwise the row stays clean.
          badge: runningCount > 0 ? String(runningCount) : undefined,
        },
        { to: '/barcodes', label: 'Barcode generator', icon: IconBarcode },
        { to: '/files', label: t('nav.files'), icon: IconFiles },
      ],
    },
    {
      heading: t('nav.system'),
      items: [
        { to: '/history', label: 'History', icon: IconHistory },
        { to: '/settings', label: t('nav.settings'), icon: IconSettings },
      ],
    },
  ];
  return (
    <aside className="flex h-full w-60 flex-col border-r border-border-base bg-bg-surface">
      {/* Stoplight strip — empty drag region so window can be moved by
          dragging the area where macOS draws the close/min/zoom buttons.
          Sized to the buttons + a little breathing room. */}
      <div className="drag-region h-7 w-full" />

      {/* App identity — small dark-rounded "LS" mark + name, sits BELOW
          the stoplight (mirroring Image Studio KH's reference layout).
          Inline SVG so we don't pull an icon dep / image asset. */}
      <div className="drag-region flex items-center gap-2.5 px-4 pb-3 pt-1">
        <AppLogoMark />
        <span className="truncate text-sm font-semibold tracking-tight text-fg-base">
          Label Studio KH
        </span>
      </div>

      {/* Workspace switcher — sits between title and nav, like Slack's
          workspace chip. Reads activeCompanyId and triggers downstream
          refreshes when the user picks a different company. */}
      <CompanySwitcher />

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
        {sections.map((section, i) => (
          <div key={i} className="mb-3">
            {section.heading && (
              <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
                {section.heading}
              </div>
            )}
            {section.items.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </div>
        ))}
      </nav>

      {/* Sidebar footer — mirrors the Catalog Studio KH reference layout:
          two full-width rows ("What's new", "Support this app") followed
          by a tiny version line. What's new is a button (opens a modal),
          not a route — it gets styled to match SidebarLink so the two
          rows feel like siblings. */}
      <div className="border-t border-border-subtle p-2">
        <button
          onClick={openWhatsNew}
          className="no-drag mx-1 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-base"
          title="See what changed in this and recent versions"
        >
          <IconSparkles size={18} stroke={1.75} />
          <span className="flex-1 text-left">What's new</span>
        </button>
        <SidebarLink to="/support" label={t('nav.support')} icon={IconHeart} />
        {version && (
          <div
            className="px-3 pt-2 text-[10px] text-fg-subtle"
            title={isDev ? 'Development build' : 'Production build'}
          >
            v{version}
            {isDev && (
              <span className="ml-1 rounded bg-warning/15 px-1 py-px text-[9px] font-medium text-warning">
                dev
              </span>
            )}
          </div>
        )}
      </div>

      <WhatsNewModal
        open={whatsNewOpen}
        onClose={closeWhatsNew}
        sinceVersion={seenVersion}
      />
    </aside>
  );
}

function SidebarLink({ to, label, icon: Icon, badge }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        [
          'no-drag mx-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-bg-hover text-fg-base'
            : 'text-fg-muted hover:bg-bg-hover hover:text-fg-base',
        ].join(' ')
      }
    >
      <Icon size={18} stroke={1.75} />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-fg-muted">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

// Small "LS" wordmark used at the top of the sidebar. Built with theme
// tokens (bg-fg-base / text-bg-base) so the mark inverts cleanly between
// light + dark mode — light theme: dark square + light letters; dark
// theme: light square + dark letters. Matches the Image Studio KH
// reference's compact rounded-rectangle treatment.
function AppLogoMark() {
  return (
    <div
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-fg-base text-[10px] font-bold tracking-tight text-bg-surface"
    >
      LS
    </div>
  );
}
