// IPC for direct OS printing — printer enumeration + print job dispatch.

import { ipcMain } from 'electron';
import {
  listPrinters,
  printLabels,
  type PrintLabelsInput,
} from '../services/PrintService';

export function registerPrintIpc(): void {
  ipcMain.handle('print:listPrinters', () => listPrinters());

  ipcMain.handle('print:labels', (_e, input: PrintLabelsInput) =>
    printLabels(input),
  );
}
