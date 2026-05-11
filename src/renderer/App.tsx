import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { ToastContainer, toast } from './components/Toast';
import { KeyboardHelp } from './components/KeyboardHelp';
import Dashboard from './pages/Dashboard';
import Brands from './pages/Brands';
import Templates from './pages/Templates';
import Designer from './pages/Designer';
import DataImport from './pages/DataImport';
import Generate from './pages/Generate';
import Barcodes from './pages/Barcodes';
import Files from './pages/Files';
import Settings from './pages/Settings';
import Support from './pages/Support';
import { useThemeStore } from './stores/themeStore';

export default function App() {
  const initTheme = useThemeStore((s) => s.init);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  // Auto-update toast. When the main process finishes downloading a new
  // build, it pushes `updater:update-downloaded` here. We show a sticky
  // toast with a one-click "Restart" action so the user doesn't have to
  // manually quit + reopen to apply the update. If they dismiss the toast
  // without clicking Restart, electron-updater's autoInstallOnAppQuit will
  // still apply the update next time the app quits — no work is lost.
  useEffect(() => {
    const off = window.api.updater.onUpdateDownloaded((info) => {
      toast.info(`Update v${info.version} is ready to install.`, {
        action: {
          label: 'Restart now',
          onClick: () => {
            void window.api.updater.quitAndInstall();
          },
        },
      });
    });
    return off;
  }, []);

  return (
    <div className="flex h-full w-full bg-bg-base text-fg-base">
      <Sidebar />
      <ToastContainer />
      <main className="min-w-0 flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/designer/:brandId/:templateId" element={<Designer />} />
          <Route path="/data" element={<DataImport />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/barcodes" element={<Barcodes />} />
          <Route path="/files" element={<Files />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/support" element={<Support />} />
        </Routes>
      </main>
      <KeyboardHelp />
    </div>
  );
}
