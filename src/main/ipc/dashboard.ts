import { ipcMain } from 'electron';
import { StatsService } from '../services/StatsService';
import { SettingsService } from '../services/SettingsService';

export function registerDashboardIpc(): void {
  // All three dashboard endpoints accept an optional companyId so the
  // renderer can scope numbers to the active workspace. Without it, they
  // fall back to global totals (legacy behavior, used by old client
  // builds that haven't been updated to pass the param).
  ipcMain.handle('dashboard:stats', (_e, companyId?: string) => {
    const settings = SettingsService.get();
    return StatsService.dashboard(
      settings.timeSavedMinutesPerLabel,
      companyId,
    );
  });
  ipcMain.handle(
    'dashboard:recentBrands',
    (_e, limit?: number, companyId?: string) =>
      StatsService.recentBrands(limit, companyId),
  );
  ipcMain.handle(
    'dashboard:recentActivity',
    (_e, limit?: number, companyId?: string) =>
      StatsService.recentActivity(limit, companyId),
  );
}
