import { contextBridge, ipcRenderer } from 'electron';
import type { Brand, NewBrandInput } from '../shared/types/brand';
import type { Template, NewTemplateInput } from '../shared/types/template';

const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  },
  brand: {
    list: (): Promise<Brand[]> => ipcRenderer.invoke('brand:list'),
    get: (id: string): Promise<Brand | null> => ipcRenderer.invoke('brand:get', id),
    create: (input: NewBrandInput): Promise<Brand> =>
      ipcRenderer.invoke('brand:create', input),
    update: (id: string, patch: Partial<NewBrandInput>): Promise<Brand | null> =>
      ipcRenderer.invoke('brand:update', id, patch),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('brand:delete', id),
  },
  template: {
    listForBrand: (brandId: string): Promise<Template[]> =>
      ipcRenderer.invoke('template:listForBrand', brandId),
    get: (brandId: string, templateId: string): Promise<Template | null> =>
      ipcRenderer.invoke('template:get', brandId, templateId),
    save: (input: Template | NewTemplateInput): Promise<Template> =>
      ipcRenderer.invoke('template:save', input),
    delete: (brandId: string, templateId: string): Promise<boolean> =>
      ipcRenderer.invoke('template:delete', brandId, templateId),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
