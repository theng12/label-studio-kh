import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Brands from './pages/Brands';
import Templates from './pages/Templates';
import DataImport from './pages/DataImport';
import Generate from './pages/Generate';
import Files from './pages/Files';
import Settings from './pages/Settings';
import Support from './pages/Support';
import { useThemeStore } from './stores/themeStore';

export default function App() {
  const initTheme = useThemeStore((s) => s.init);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <div className="flex h-full w-full bg-bg-base text-fg-base">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/data" element={<DataImport />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/files" element={<Files />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/support" element={<Support />} />
        </Routes>
      </main>
    </div>
  );
}
