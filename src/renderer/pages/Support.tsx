import { IconHeart, IconCoin, IconExternalLink } from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';

// ─────────────────────────────────────────────────────────────────────────────
// Donations — single NOWPayments hosted donation page.
//
// We use the *hosted* donation page (https://nowpayments.io/donation/<slug>)
// rather than the embed-widget URL. Same UX for the donor (coin / network
// picker, conversion, payout), but: (1) shorter, branded URL, (2) no
// `api_key` exposed in the link, (3) shared across every Studio-KH app for
// consistency. Slug is configured in the NOWPayments dashboard.
//
// Per-coin direct-send wallet rows used to live here too, but were removed:
// NOWPayments already gives donors a polished coin/network picker covering
// 200+ assets, so maintaining a parallel hand-curated wallet list added
// surface area without meaningfully changing the donor experience.
// ─────────────────────────────────────────────────────────────────────────────

const NOWPAYMENTS_DONATION_URL = 'https://nowpayments.io/donation/studiokh';

const nowpaymentsConfigured =
  !!NOWPAYMENTS_DONATION_URL && !NOWPAYMENTS_DONATION_URL.includes('TODO_');

export default function Support() {
  const onOpenNowpayments = () => {
    if (!nowpaymentsConfigured) return;
    // The main process intercepts window.open via setWindowOpenHandler and
    // routes it through shell.openExternal — the URL opens in the user's
    // default browser, not an embedded Electron window. See main/index.ts.
    // Browser flow is strictly better for crypto: donors have their wallet
    // extensions / wallet apps installed in the browser, not in this
    // Electron renderer.
    window.open(NOWPAYMENTS_DONATION_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <Page title="Support development">
      {/* Headline card — always visible. Sets expectations: the app is free,
          donations are voluntary, no functional change either way. */}
      <div className="rounded-lg border border-border-base bg-bg-surface p-8 text-center">
        <IconHeart size={32} className="mx-auto text-danger" />
        <h2 className="mt-4 text-lg font-semibold text-fg-base">
          Label Studio KH is free, with all features unlocked.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          If it saves you hours each week, you can support development with a
          one-time donation. Donations keep the app maintained, the bugs fixed,
          and the bundled fonts updated. Thank you 💛
        </p>
      </div>

      {/* Donate card. Single button — NOWPayments handles coin / network
          picking, conversion, and payout. */}
      <div className="mt-6 rounded-lg border border-border-base bg-bg-surface p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg-base">
          <IconCoin size={16} /> Donate
        </div>

        {!nowpaymentsConfigured ? (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-fg-muted">
            Donations are being set up. The next app update will include a
            payment widget here. Thanks for your patience.
          </div>
        ) : (
          <div>
            <Button
              variant="primary"
              onClick={onOpenNowpayments}
              title="Opens NOWPayments in your browser. Pick any supported coin and donation amount."
            >
              <IconCoin size={14} /> Pay with crypto (NOWPayments)
              <IconExternalLink size={12} />
            </Button>
            <div className="mt-2 text-[10px] text-fg-subtle">
              Donate in any of 200+ coins via NOWPayments — handles
              conversion, no account needed on your end. Opens in your
              default browser.
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
