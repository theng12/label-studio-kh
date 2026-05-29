import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconDatabaseImport, IconWand, IconHeart, IconX } from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useCompanyStore } from '../stores/companyStore';

type Stats = Awaited<ReturnType<typeof window.api.dashboard.stats>>;
type RecentBrand = Awaited<ReturnType<typeof window.api.dashboard.recentBrands>>[number];
type Activity = Awaited<ReturnType<typeof window.api.dashboard.recentActivity>>[number];

const DONATION_DISMISS_KEY = 'lskh.donationDismissedAt';

export default function Dashboard() {
  const navigate = useNavigate();
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  // Resolve the active company's name so the Page subtitle can read
  // "Workspace for <name>" — gives the user immediate context for which
  // workspace's numbers they're looking at, without forcing them to glance
  // back at the sidebar switcher.
  const activeCompanyName = useCompanyStore(
    (s) =>
      s.companies.find((c) => c.id === s.activeCompanyId)?.name ?? null,
  );
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBrands, setRecentBrands] = useState<RecentBrand[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [showDonate, setShowDonate] = useState(false);

  // Re-fetch whenever the active company changes — the user expects the
  // Dashboard numbers to reflect their current workspace, not the union
  // of every company they've ever created.
  useEffect(() => {
    const load = async () => {
      const cid = activeCompanyId ?? undefined;
      const [s, b, a] = await Promise.all([
        window.api.dashboard.stats(cid),
        window.api.dashboard.recentBrands(5, cid),
        window.api.dashboard.recentActivity(10, cid),
      ]);
      setStats(s);
      setRecentBrands(b);
      setActivity(a);
    };
    void load();
  }, [activeCompanyId]);

  // Donation nudge: shows on first launch and again 7 days after the user
  // dismisses it. No license gating (the app is free; donations are the only
  // way to support development now).
  useEffect(() => {
    const at = localStorage.getItem(DONATION_DISMISS_KEY);
    if (!at) {
      setShowDonate(true);
      return;
    }
    const lastMs = parseInt(at, 10);
    const ageDays = (Date.now() - lastMs) / (1000 * 60 * 60 * 24);
    setShowDonate(ageDays >= 7);
  }, []);

  const dismissDonate = () => {
    localStorage.setItem(DONATION_DISMISS_KEY, String(Date.now()));
    setShowDonate(false);
  };

  return (
    <Page
      title="Dashboard"
      subtitle={
        activeCompanyName ? `Workspace for ${activeCompanyName}` : undefined
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Brands" value={stats?.brandCount ?? 0} />
        <StatCard label="SKUs" value={stats?.skuCount ?? 0} />
        <StatCard label="Labels generated" value={stats?.totalGenerated ?? 0} />
        <StatCard
          label="Time saved"
          value={formatMinutes(stats?.timeSavedMinutes ?? 0)}
          hint="vs manual Canva method"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Recent brands" empty={recentBrands.length === 0}>
          {recentBrands.map((b) => (
            <button
              key={b.id}
              onClick={() => navigate(`/templates?brand=${b.id}`)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-bg-hover"
            >
              <span
                className="h-4 w-4 shrink-0 rounded border border-border-base"
                style={{ background: b.color }}
              />
              <span className="flex-1 truncate text-fg-base">{b.name}</span>
              <span className="text-xs text-fg-subtle">
                {b.templateCount} template{b.templateCount === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </Panel>

        <Panel title="Recent activity" empty={activity.length === 0}>
          {activity.map((ev, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-md px-2 py-2 text-sm"
            >
              <span
                className={[
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded',
                  ev.type === 'import' ? 'bg-bg-elevated text-accent' : 'bg-bg-elevated text-success',
                ].join(' ')}
              >
                {ev.type === 'import' ? (
                  <IconDatabaseImport size={14} />
                ) : (
                  <IconWand size={14} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-fg-base">{ev.summary}</div>
                {ev.detail && (
                  <div className="truncate text-xs text-fg-muted">{ev.detail}</div>
                )}
              </div>
              <span className="shrink-0 text-xs text-fg-subtle">
                {formatRelative(ev.at)}
              </span>
            </div>
          ))}
        </Panel>
      </div>

      {showDonate && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-border-base bg-bg-surface p-4">
          <IconHeart size={18} className="mt-0.5 text-danger" />
          <div className="flex-1 text-sm text-fg-base">
            <strong>Label Studio KH is free.</strong> If it saves you hours each
            week, you can support development with a donation — every bit keeps
            the app maintained and the bugs fixed.
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/support')}>
            Donate
          </Button>
          <button
            onClick={dismissDonate}
            aria-label="Dismiss for 7 days"
            title="Dismiss for 7 days"
            className="rounded p-1 text-fg-muted hover:text-fg-base"
          >
            <IconX size={14} />
          </button>
        </div>
      )}
    </Page>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border-base bg-bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-fg-base">{value}</div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </div>
  );
}

function Panel({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-base bg-bg-surface p-4">
      <div className="mb-3 text-sm font-semibold text-fg-base">{title}</div>
      {empty ? (
        <div className="px-2 py-4 text-sm text-fg-muted">Nothing yet.</div>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const remainder = min % 60;
  if (hours < 24) return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.round((now - then) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}
