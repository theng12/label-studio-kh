import { ipcMain } from 'electron';
import {
  FileService,
  type FileFilters,
  type FileListOptions,
} from '../services/FileService';

export function registerFileIpc(): void {
  ipcMain.handle('file:list', (_e, filters: FileFilters) => FileService.list(filters));
  ipcMain.handle('file:listPaged', (_e, opts: FileListOptions) =>
    FileService.listPaged(opts),
  );
  // v6+: distinctSizes accepts an optional companyId so the sidebar
  // sizes list reflects only the active workspace.
  ipcMain.handle('file:distinctSizes', (_e, companyId?: string) =>
    FileService.distinctSizes(companyId),
  );
  ipcMain.handle('file:storageStats', (_e, companyId?: string) =>
    FileService.storageStats(companyId),
  );
  ipcMain.handle('file:delete', (_e, id: string, alsoFromDisk: boolean) =>
    FileService.delete(id, alsoFromDisk),
  );
  ipcMain.handle('file:restore', (_e, id: string) => FileService.restore(id));
  ipcMain.handle('file:reprint', (_e, id: string) => FileService.reprint(id));
}
