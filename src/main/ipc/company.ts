import { ipcMain } from 'electron';
import { CompanyService } from '../services/CompanyService';
import type { CompanyInput } from '@shared/types/company';

export function registerCompanyIpc(): void {
  ipcMain.handle('company:list', () => CompanyService.list());
  ipcMain.handle('company:get', (_e, id: string) => CompanyService.get(id));
  ipcMain.handle('company:create', (_e, input: CompanyInput) =>
    CompanyService.create(input),
  );
  ipcMain.handle(
    'company:update',
    (_e, id: string, patch: Partial<CompanyInput>) =>
      CompanyService.update(id, patch),
  );
  ipcMain.handle('company:remove', (_e, id: string) =>
    CompanyService.remove(id),
  );
}
