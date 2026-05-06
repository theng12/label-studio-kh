import { Page } from '../components/Page';

export default function Dashboard() {
  return (
    <Page title="Dashboard">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Brands" value="1" hint="Demo brand only" />
        <StatCard label="SKUs" value="0" hint="No products imported yet" />
        <StatCard label="Labels generated" value="0" hint="All time" />
        <StatCard label="Time saved" value="0 min" hint="Estimated" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Panel title="Recent brands">
          <p className="text-sm text-fg-muted">No recent brands yet.</p>
        </Panel>
        <Panel title="Recent activity">
          <p className="text-sm text-fg-muted">No activity yet.</p>
        </Panel>
      </div>
    </Page>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border-base bg-bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-fg-base">{value}</div>
      <div className="mt-1 text-xs text-fg-muted">{hint}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-base bg-bg-surface p-4">
      <div className="mb-3 text-sm font-semibold text-fg-base">{title}</div>
      {children}
    </div>
  );
}
