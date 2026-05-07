import { app, BrowserWindow, shell, protocol, net } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerAppIpc } from './ipc/app';
import { registerBrandIpc } from './ipc/brand';
import { registerTemplateIpc } from './ipc/template';
import { registerImportIpc } from './ipc/import';
import { registerExportIpc } from './ipc/export';
import { registerDashboardIpc } from './ipc/dashboard';
import { registerFileIpc } from './ipc/file';
import { registerSettingsIpc } from './ipc/settings';
import { registerLicenseIpc } from './ipc/license';
import { registerSkuIpc } from './ipc/sku';
import { registerDialogIpc } from './ipc/dialog';
import { registerBarcodeIpc } from './ipc/barcode';
import { shutdownBarcodeBrowser } from './services/BarcodeService';
import { shutdownBrowser } from './services/ExportService';
import { closeDb } from './services/Database';
import { DemoSeed } from './services/DemoSeed';
import { initUpdater } from './services/Updater';
import { loadEnv } from './services/EnvLoader';

const isDev = !app.isPackaged;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#0e0f12',
    titleBarStyle: 'hiddenInset',
    title: 'Label Studio KH',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

// Allow the renderer to display local files via a custom protocol. Plain
// file:// URLs are blocked by the renderer's CSP; this gives us a controlled
// way to expose user-picked images and brand assets to <img src="..." />.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lskh-file',
    privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: true },
  },
]);

app.whenReady().then(() => {
  // Resolve lskh-file://<absolute-path-with-leading-slash> by stripping the
  // scheme + host and serving the file directly.
  protocol.handle('lskh-file', (request) => {
    const url = new URL(request.url);
    // Path starts with a leading "/"; on macOS this is already an absolute
    // POSIX path. Decode to handle spaces and other URL-escaped chars.
    const filePath = decodeURIComponent(url.pathname);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  loadEnv();
  registerAppIpc();
  registerBrandIpc();
  registerTemplateIpc();
  registerImportIpc();
  registerExportIpc();
  registerDashboardIpc();
  registerFileIpc();
  registerSettingsIpc();
  registerLicenseIpc();
  registerSkuIpc();
  registerDialogIpc();
  registerBarcodeIpc();
  try {
    DemoSeed.ensure();
  } catch (err) {
    console.error('Demo seed failed:', err);
  }
  initUpdater();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  await shutdownBrowser();
  await shutdownBarcodeBrowser();
  closeDb();
});
