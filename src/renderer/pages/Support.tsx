import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  IconHeart,
  IconCoin,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { toast } from '../components/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Donation config. The whole file is the donate page now; licensing is gone.
//
// **To go live**: replace the TODO_ values below with the real ones. Strings
// that still equal their TODO_ default are treated as "not configured" and
// hidden from the UI so a half-configured app shows a clean "donations are
// being set up" placeholder rather than a broken link.
// ─────────────────────────────────────────────────────────────────────────────

// This is the NOWPayments donation-widget URL from the dashboard's embed
// snippet. The `api_key` here is the *public* widget key — NOWPayments
// designs widget keys to be embedded in HTML anyone can view-source on,
// distinct from the private REST API key. Safe to commit.
//
// The URL also works as a standalone page in a browser, so we open it via
// window.open() rather than embedding the iframe in-app. Browser flow is
// strictly better for crypto: donors have their wallet extensions /
// wallet apps installed in the browser, not in this Electron renderer.
const NOWPAYMENTS_DONATION_URL =
  'https://nowpayments.io/embeds/donation-widget?api_key=92d6495a-2be6-4996-b8ba-aabef74d232e';

interface WalletAddress {
  /** Short symbol shown in the row header, e.g. "BTC". */
  label: string;
  /** Full chain / network description, e.g. "Bitcoin (SegWit)". */
  chain: string;
  /** Actual on-chain address. */
  address: string;
}

const WALLETS: WalletAddress[] = [
  { label: 'BTC', chain: 'Bitcoin', address: 'TODO_BTC_ADDRESS' },
  { label: 'ETH', chain: 'Ethereum (ERC20)', address: 'TODO_ETH_ADDRESS' },
  { label: 'USDT', chain: 'USDT on Tron (TRC20)', address: 'TODO_USDT_TRC20_ADDRESS' },
];

const isConfigured = (s: string) => !s.startsWith('TODO_') && !s.includes('TODO_');

export default function Support() {
  const nowpaymentsReady = isConfigured(NOWPAYMENTS_DONATION_URL);
  const configuredWallets = useMemo(
    () => WALLETS.filter((w) => isConfigured(w.address)),
    [],
  );
  const anyConfigured = nowpaymentsReady || configuredWallets.length > 0;
  const [walletsOpen, setWalletsOpen] = useState(false);

  const onOpenNowpayments = () => {
    if (!nowpaymentsReady) return;
    // The main process intercepts window.open via setWindowOpenHandler and
    // routes it through shell.openExternal — the URL opens in the user's
    // default browser, not an embedded Electron window. See main/index.ts.
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

      {/* Donate card. When no payment methods are configured (build still
          ships the TODO_ placeholders), show a polite placeholder instead of
          broken/dead buttons. */}
      <div className="mt-6 rounded-lg border border-border-base bg-bg-surface p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg-base">
          <IconCoin size={16} /> Donate
        </div>

        {!anyConfigured ? (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-fg-muted">
            Donations are being set up. The next app update will include a
            payment widget and crypto wallet addresses here. Thanks for your
            patience.
          </div>
        ) : (
          <div className="space-y-4">
            {nowpaymentsReady && (
              <div>
                <Button
                  variant="primary"
                  onClick={onOpenNowpayments}
                  title="Opens NOWPayments in your browser. Pick any supported coin and donation amount."
                >
                  <IconCoin size={14} /> Pay with crypto (NOWPayments)
                  <IconExternalLink size={12} />
                </Button>
                <div className="mt-1 text-[10px] text-fg-subtle">
                  Donate in any of 200+ coins via NOWPayments — handles
                  conversion, no account needed on your end.
                </div>
              </div>
            )}

            {configuredWallets.length > 0 && (
              <div>
                <button
                  onClick={() => setWalletsOpen((v) => !v)}
                  className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg-base"
                >
                  {walletsOpen ? (
                    <IconChevronDown size={12} />
                  ) : (
                    <IconChevronRight size={12} />
                  )}
                  Or send directly to a wallet (no fees, no intermediary)
                </button>
                {walletsOpen && (
                  <div className="mt-3 space-y-3">
                    {configuredWallets.map((w) => (
                      <WalletRow key={w.label} wallet={w} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}

// ── Wallet row: chain label + address + copy button + QR code ───────────────

function WalletRow({ wallet }: { wallet: WalletAddress }) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw the QR for this address into the row's canvas. Re-runs only when the
  // address changes (which is build-time only, but kept correct for editing).
  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, wallet.address, {
      width: 100,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(() => {
      // Bad address → nothing to render. The text is still visible so the
      // user can verify what's wrong.
    });
  }, [wallet.address]);

  const onCopy = async () => {
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    toast.success(`${wallet.label} address copied to clipboard.`);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-base p-3">
      <canvas
        ref={canvasRef}
        width={100}
        height={100}
        className="shrink-0 rounded bg-white p-0.5"
        aria-label={`${wallet.label} address QR code`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-fg-base">
            {wallet.label}
          </span>
          <span className="text-[10px] text-fg-subtle">{wallet.chain}</span>
        </div>
        <code
          className="block break-all rounded bg-bg-elevated px-2 py-1 font-mono text-[11px] text-fg-muted"
          title={wallet.address}
        >
          {wallet.address}
        </code>
        <button
          onClick={() => void onCopy()}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
        >
          {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
          {copied ? 'Copied' : 'Copy address'}
        </button>
      </div>
    </div>
  );
}
