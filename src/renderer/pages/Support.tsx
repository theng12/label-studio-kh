import { Page } from '../components/Page';
import { IconHeart } from '@tabler/icons-react';

export default function Support() {
  return (
    <Page title="Support this app">
      <div className="rounded-lg border border-border-base bg-bg-surface p-8 text-center">
        <IconHeart size={32} className="mx-auto text-danger" />
        <h2 className="mt-4 text-lg font-semibold text-fg-base">
          Label Studio KH is free, with all features unlocked.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          If it saves you hours each week, you can support development with a one-time
          donation or license. License keys land in Phase 4.
        </p>
      </div>
    </Page>
  );
}
