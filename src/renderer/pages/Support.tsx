import { useEffect, useState } from 'react';
import { IconHeart, IconCheck, IconKey } from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useLicenseStore } from '../stores/licenseStore';

export default function Support() {
  const { licensed, name, refresh, activate, deactivate } = useLicenseStore();
  const [inputName, setInputName] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onActivate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const ok = await activate(inputName, inputKey);
      if (!ok) {
        setError(
          'That key did not validate for that name. Double-check both, including capitalisation. The key looks like LC-XXXX-XXXX-XXXX-XXXX.',
        );
      } else {
        setInputName('');
        setInputKey('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page title="Support this app">
      <div className="rounded-lg border border-border-base bg-bg-surface p-8 text-center">
        <IconHeart size={32} className="mx-auto text-danger" />
        <h2 className="mt-4 text-lg font-semibold text-fg-base">
          Label Studio KH is free, with all features unlocked.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          If it saves you hours each week, you can support development with a
          one-time donation or license. There is no functional difference between
          a licensed and unlicensed copy — only the dashboard nudge hides and a
          small "Licensed" badge appears in the title bar.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-border-base bg-bg-surface p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg-base">
          <IconKey size={16} /> License key
        </div>

        {licensed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm">
              <IconCheck size={16} className="text-success" />
              <span>
                Licensed to <strong>{name}</strong>. Thank you for your support.
              </span>
            </div>
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void deactivate()}
              >
                Remove license from this machine
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-fg-muted">
              Enter your name and key exactly as they were issued. Validation
              happens on this machine — no internet required.
            </p>
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Licensee name</span>
              <input
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Jane Doe"
                className="mt-1 w-full rounded-md border border-border-base bg-bg-base px-2 py-1.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">License key</span>
              <input
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="LC-XXXX-XXXX-XXXX-XXXX"
                className="mt-1 w-full rounded-md border border-border-base bg-bg-base px-2 py-1.5 text-sm font-mono uppercase focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </label>
            {error && (
              <div className="rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
                {error}
              </div>
            )}
            <Button
              variant="primary"
              onClick={() => void onActivate()}
              disabled={submitting || !inputName.trim() || !inputKey.trim()}
            >
              {submitting ? 'Validating…' : 'Activate'}
            </Button>
          </div>
        )}
      </div>
    </Page>
  );
}
