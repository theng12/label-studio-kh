// IPC for the Jobs / Generation-History page. The active jobs are tracked
// client-side in useJobsStore (in-memory only, scoped to the current
// session). Historical batches come from the SQLite `generations` table —
// surfaced through this thin IPC wrapper.

import { ipcMain } from 'electron';
import { GenerationsService } from '../services/GenerationsService';

export function registerGenerationsIpc(): void {
  ipcMain.handle(
    'generations:listBatches',
    (_e, companyId?: string, limit?: number) =>
      GenerationsService.listBatches(companyId, limit),
  );
}
