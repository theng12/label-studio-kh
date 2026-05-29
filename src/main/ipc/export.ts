import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import {
  exportSingle,
  exportBulk,
  exportSheetPdf,
  type ExportSettings,
  type SingleExportInput,
  type SheetPdfInput,
} from '../services/ExportService';
import type { Template } from '@shared/types/template';
import type { Brand } from '@shared/types/brand';

const cancelFlags = new Map<string, boolean>();

export function registerExportIpc(): void {
  ipcMain.handle(
    'export:pickFolder',
    async (_e, defaultPath?: string): Promise<string | null> => {
      const result = await dialog.showOpenDialog({
        title: 'Select output folder',
        defaultPath,
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0]!;
    },
  );

  ipcMain.handle('export:openInOS', async (_e, filePath: string) => {
    await shell.openPath(filePath);
  });

  ipcMain.handle('export:revealInFinder', async (_e, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('export:sheetPdf', async (_e, input: SheetPdfInput) =>
    exportSheetPdf(input),
  );

  ipcMain.handle(
    'export:single',
    async (
      _e,
      input: Omit<SingleExportInput, 'batchId'> & { batchId?: string },
    ) =>
      exportSingle({
        ...input,
        batchId: input.batchId ?? 'preview',
      }),
  );

  // Bulk export streams progress events back to the renderer via webContents.send.
  ipcMain.handle(
    'export:bulk',
    async (
      e,
      payload: {
        runId: string;
        template: Template;
        brand: Brand | null;
        rows: Record<string, string>[];
        settings: ExportSettings;
      },
    ) => {
      cancelFlags.set(payload.runId, false);

      const win = BrowserWindow.fromWebContents(e.sender);

      const summary = await exportBulk({
        template: payload.template,
        brand: payload.brand,
        rows: payload.rows,
        settings: payload.settings,
        isCancelled: () => cancelFlags.get(payload.runId) === true,
        onProgress: (info) => {
          win?.webContents.send(`export:progress:${payload.runId}`, info);
        },
      });

      cancelFlags.delete(payload.runId);
      return summary;
    },
  );

  ipcMain.handle('export:cancel', (_e, runId: string) => {
    cancelFlags.set(runId, true);
  });
}
