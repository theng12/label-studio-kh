import { app } from 'electron';
import pkg from 'electron-updater';

const { autoUpdater } = pkg;

// Auto-updater is opt-in. It only runs when:
//   1. The app is packaged (production build), and
//   2. An update channel is configured via the publish field in
//      electron-builder.yml or via env (e.g. GH_TOKEN for GitHub Releases).
//
// In development or when no channel is set, this is a no-op so the app starts
// cleanly without a fake "checking for updates" loop.
export function initUpdater(): void {
  if (!app.isPackaged) return;

  // Only error/info logs to stdout; update events are quiet by default.
  autoUpdater.logger = {
    info: (...args: unknown[]) => console.log('[updater]', ...args),
    warn: (...args: unknown[]) => console.warn('[updater]', ...args),
    error: (...args: unknown[]) => console.error('[updater]', ...args),
    debug: () => {},
  } as unknown as typeof console;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    // No publish channel configured → 404 from the feed URL. Swallow silently
    // so the user doesn't see noise about updates that aren't set up yet.
    if (/HttpError: 404/.test(err.message)) return;
    console.error('[updater] error:', err);
  });

  void autoUpdater.checkForUpdatesAndNotify().catch(() => {
    // ignored: see error handler above
  });
}
