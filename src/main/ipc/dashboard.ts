import { ipcMain } from 'electron';
import { StatsService } from '../services/StatsService';
import { SettingsService } from '../services/SettingsService';

export function registerDashboardIpc(): void {
  ipcMain.handle('dashboard:stats', () => {
    const settings = SettingsService.get();
    return StatsService.dashboard(settings.timeSavedMinutesPerLabel);
  });
  ipcMain.handle('dashboard:recentBrands', (_e, limit?: number) =>
    StatsService.recentBrands(limit),
  );
  ipcMain.handle('dashboard:recentActivity', (_e, limit?: number) =>
    StatsService.recentActivity(limit),
  );
}
