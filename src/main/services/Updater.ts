import { app, BrowserWindow, ipcMain } from 'electron';
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
  // Always register the IPC handlers so the renderer's listeners don't
  // crash with "no handler registered" in dev or when no channel is
  // configured — they just return null / no-op.
  ipcMain.handle('updater:quitAndInstall', () => {
    if (!app.isPackaged) return false;
    // isSilent=true, isForceRunAfter=true → install immediately and relaunch
    // the app on the new version without showing the platform installer UI.
    autoUpdater.quitAndInstall(true, true);
    return true;
  });

  ipcMain.handle('updater:checkNow', async () => {
    if (!app.isPackaged) return { ok: false, reason: 'dev-build' };
    try {
      const r = await autoUpdater.checkForUpdates();
      return { ok: true, version: r?.updateInfo?.version ?? null };
    } catch (err) {
      return { ok: false, reason: String(err) };
    }
  });

  if (!app.isPackaged) return;

  // Only error/info logs to stdout; update events are quiet by default.
  autoUpdater.logger = {
    info: (...args: unknown[]) => console.log('[updater]', ...args),
    warn: (...args: unknown[]) => console.warn('[updater]', ...args),
    error: (...args: unknown[]) => console.error('[updater]', ...args),
    debug: () => {},
  } as unknown as typeof console;

  autoUpdater.autoDownload = true;
  // Belt-and-suspenders: if the user dismisses the in-app restart prompt,
  // the update still installs the next time the app quits. The prompt is
  // a one-click shortcut, not a requirement.
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    // No publish channel configured → 404 from the feed URL. Swallow silently
    // so the user doesn't see noise about updates that aren't set up yet.
    if (/HttpError: 404/.test(err.message)) return;
    console.error('[updater] error:', err);
  });

  // When the new build finishes downloading, push a message to every renderer
  // window so the in-app toast can offer a one-click restart. We broadcast
  // because the windows list can change over the app's lifetime (close +
  // reopen on macOS); send to whatever's open.
  autoUpdater.on('update-downloaded', (info) => {
    const payload = {
      version: info.version,
      releaseDate: info.releaseDate ?? null,
    };
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('updater:update-downloaded', payload);
    }
  });

  void autoUpdater.checkForUpdatesAndNotify().catch(() => {
    // ignored: see error handler above
  });
}
