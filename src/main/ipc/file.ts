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
  ipcMain.handle('file:distinctSizes', () => FileService.distinctSizes());
  ipcMain.handle('file:delete', (_e, id: string, alsoFromDisk: boolean) =>
    FileService.delete(id, alsoFromDisk),
  );
  ipcMain.handle('file:restore', (_e, id: string) => FileService.restore(id));
  ipcMain.handle('file:reprint', (_e, id: string) => FileService.reprint(id));
}
