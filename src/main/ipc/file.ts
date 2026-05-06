import { ipcMain } from 'electron';
import { FileService, type FileFilters } from '../services/FileService';

export function registerFileIpc(): void {
  ipcMain.handle('file:list', (_e, filters: FileFilters) => FileService.list(filters));
  ipcMain.handle('file:distinctSizes', () => FileService.distinctSizes());
  ipcMain.handle('file:delete', (_e, id: string, alsoFromDisk: boolean) =>
    FileService.delete(id, alsoFromDisk),
  );
  ipcMain.handle('file:reprint', (_e, id: string) => FileService.reprint(id));
}
