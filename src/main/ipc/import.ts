import { ipcMain, dialog, app } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseFile,
  autoMap,
  validate,
  findConflicts,
  commit,
  listSkusForBrand,
  listImports,
} from '../services/ImportService';
import type { CommitInput } from '@shared/types/import';

export function registerImportIpc(): void {
  ipcMain.handle('import:pickFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select CSV or Excel file',
      properties: ['openFile'],
      filters: [
        { name: 'Data files', extensions: ['csv', 'tsv', 'xlsx', 'xls'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('import:demoSamplePath', () => {
    const p = join(app.getPath('userData'), 'demo-products.csv');
    return existsSync(p) ? p : null;
  });

  ipcMain.handle('import:parseFile', (_e, path: string) => parseFile(path));
  ipcMain.handle('import:autoMap', (_e, columns: string[]) => autoMap(columns));
  ipcMain.handle(
    'import:validate',
    (_e, rows: Record<string, string>[], mapping: Record<string, string | null>) =>
      validate(rows, mapping),
  );
  ipcMain.handle(
    'import:findConflicts',
    (
      _e,
      brandId: string,
      rows: Record<string, string>[],
      mapping: Record<string, string | null>,
    ) => findConflicts(brandId, rows, mapping),
  );
  ipcMain.handle('import:commit', (_e, input: CommitInput) => commit(input));
  ipcMain.handle('import:listSkus', (_e, brandId: string) => listSkusForBrand(brandId));
  ipcMain.handle('import:listImports', (_e, brandId?: string) => listImports(brandId));
}
