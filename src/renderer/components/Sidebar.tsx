import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconLayoutDashboard,
  IconBuildingStore,
  IconBuilding,
  IconTemplate,
  IconPackage,
  IconDatabaseImport,
  IconWand,
  IconFiles,
  IconBarcode,
  IconSettings,
  IconHeart,
  IconSparkles,
  type Icon,
} from '@tabler/icons-react';
import { WhatsNewModal } from './WhatsNew';
import { CompanySwitcher } from './CompanySwitcher';

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
    // Manual open: still show entries newer than the last persisted seen
    // version. After they close, we'll bump it to current.
    setSeenVersion(localStorage.getItem(WHATSNEW_LAST_SEEN_KEY));
    setWhatsNewOpen(true);
  };

  const sections: NavSection[] = [
    {
      items: [
        { to: '/', label: t('nav.dashboard'), icon: IconLayoutDashboard },
        { to: '/company', label: 'Company', icon: IconBuilding },
        { to: '/brands', label: t('nav.brands'), icon: IconBuildingStore },
      ],
    },
    {
      heading: t('nav.production'),
      items: [
        { to: '/products', label: 'Product Library', icon: IconPackage },
        { to: '/templates', label: t('nav.templates'), icon: IconTemplate },
        { to: '/data', label: t('nav.data'), icon: IconDatabaseImport },
        { to: '/generate', label: t('nav.generate'), icon: IconWand },
        { to: '/barcodes', label: 'Barcode generator', icon: IconBarcode },
        { to: '/files', label: t('nav.files'), icon: IconFiles },
      ],
    },
    {
      heading: t('nav.system'),
      items: [{ to: '/settings', label: t('nav.settings'), icon: IconSettings }],
    },
  ];
  return (
    <aside className="flex h-full w-60 flex-col border-r border-border-base bg-bg-surface">
      <div className="drag-region flex h-12 items-center px-4 text-sm font-semibold tracking-wide text-fg-base">
        <span className="ml-16">Label Studio KH</span>
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

      <div className="border-t border-border-subtle p-2">
        <SidebarLink to="/support" label={t('nav.support')} icon={IconHeart} />
        {version && (
          <div
            className="flex items-center justify-between px-3 pb-1 pt-2 text-[10px] text-fg-subtle"
            title={isDev ? 'Development build' : 'Production build'}
          >
            <span>
              v{version}
              {isDev && (
                <span className="ml-1 rounded bg-warning/15 px-1 py-px text-[9px] font-medium text-warning">
                  dev
                </span>
              )}
            </span>
            <button
              onClick={openWhatsNew}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-fg-muted hover:bg-bg-hover hover:text-fg-base"
              title="See what changed in this and recent versions"
            >
              <IconSparkles size={10} stroke={2} /> What's new
            </button>
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
