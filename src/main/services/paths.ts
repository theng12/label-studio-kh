import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

// All user-generated data lives under userData (per-OS app data location).
// In development this is ~/Library/Application Support/Electron/ on macOS,
// or wherever Electron decides; in production it's the productName folder.
//
// Keeping these in one place makes it easy to relocate or back up.
function userData(): string {
  return app.getPath('userData');
}

export const paths = {
  brandsFile(): string {
    return join(userData(), 'brands.json');
  },
  companiesFile(): string {
    return join(userData(), 'companies.json');
  },
  templatesDir(brandId?: string): string {
    return brandId
      ? join(userData(), 'templates', brandId)
      : join(userData(), 'templates');
  },
  templateFile(brandId: string, templateId: string): string {
    return join(paths.templatesDir(brandId), `${templateId}.json`);
  },
  assetsDir(brandId: string): string {
    return join(userData(), 'assets', brandId);
  },
  ensure(dir: string): void {
    mkdirSync(dir, { recursive: true });
  },
};
