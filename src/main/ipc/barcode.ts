import { ipcMain, BrowserWindow } from 'electron';
import {
  BarcodeService,
  type BarcodeBatchInput,
  type BarcodeBatchSummary,
} from '../services/BarcodeService';

const cancelFlags = new Map<string, boolean>();

export function registerBarcodeIpc(): void {
  ipcMain.handle(
    'barcode:generateBatch',
    async (
      e,
      payload: { runId: string; input: BarcodeBatchInput },
    ): Promise<BarcodeBatchSummary> => {
      cancelFlags.set(payload.runId, false);
      const win = BrowserWindow.fromWebContents(e.sender);

      const summary = await BarcodeService.generateBatch(
        payload.input,
        (info) => win?.webContents.send(`barcode:progress:${payload.runId}`, info),
        () => cancelFlags.get(payload.runId) === true,
      );
      cancelFlags.delete(payload.runId);
      return summary;
    },
  );

  ipcMain.handle('barcode:cancel', (_e, runId: string) => {
    cancelFlags.set(runId, true);
  });
}
