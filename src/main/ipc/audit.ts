// IPC for the global History page. The audit_log is written by the
// services (ProductService, ImportService, …); this just exposes a
// read-only feed + count for the renderer.

import { ipcMain } from 'electron';
import { AuditService, type AuditEntityType } from '../services/AuditService';

export function registerAuditIpc(): void {
  ipcMain.handle(
    'audit:listRecent',
    (
      _e,
      opts?: {
        companyId?: string | null;
        entityType?: AuditEntityType | null;
        limit?: number;
        offset?: number;
      },
    ) => AuditService.listRecent(opts ?? {}),
  );

  ipcMain.handle(
    'audit:countRecent',
    (
      _e,
      opts?: { companyId?: string | null; entityType?: AuditEntityType | null },
    ) => AuditService.countRecent(opts ?? {}),
  );
}
