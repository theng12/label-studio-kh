import { ipcMain } from 'electron';
import { TemplateService } from '../services/TemplateService';
import type { Template, NewTemplateInput } from '@shared/types/template';

export function registerTemplateIpc(): void {
  ipcMain.handle('template:listForBrand', (_e, brandId: string) =>
    TemplateService.listForBrand(brandId),
  );
  ipcMain.handle('template:get', (_e, brandId: string, templateId: string) =>
    TemplateService.get(brandId, templateId),
  );
  ipcMain.handle('template:save', (_e, input: Template | NewTemplateInput) =>
    TemplateService.save(input),
  );
  ipcMain.handle('template:delete', (_e, brandId: string, templateId: string) =>
    TemplateService.delete(brandId, templateId),
  );
  ipcMain.handle('template:duplicate', (_e, brandId: string, templateId: string) =>
    TemplateService.duplicate(brandId, templateId),
  );
}
