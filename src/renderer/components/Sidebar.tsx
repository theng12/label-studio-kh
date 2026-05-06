import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconLayoutDashboard,
  IconBuildingStore,
  IconTemplate,
  IconDatabaseImport,
  IconWand,
  IconFiles,
  IconSettings,
  IconHeart,
  type Icon,
} from '@tabler/icons-react';

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

  const sections: NavSection[] = [
    {
      items: [
        { to: '/', label: t('nav.dashboard'), icon: IconLayoutDashboard },
        { to: '/brands', label: t('nav.brands'), icon: IconBuildingStore },
        { to: '/templates', label: t('nav.templates'), icon: IconTemplate },
      ],
    },
    {
      heading: t('nav.production'),
      items: [
        { to: '/data', label: t('nav.data'), icon: IconDatabaseImport },
        { to: '/generate', label: t('nav.generate'), icon: IconWand },
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
      </div>
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
