import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Template, NewTemplateInput } from '@shared/types/template';
import { paths } from './paths';

function nowIso(): string {
  return new Date().toISOString();
}

export const TemplateService = {
  listForBrand(brandId: string): Template[] {
    const dir = paths.templatesDir(brandId);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as Template;
        } catch (err) {
          console.error(`Failed to parse template ${f}:`, err);
          return null;
        }
      })
      .filter((t): t is Template => t !== null);
  },

  get(brandId: string, templateId: string): Template | null {
    const file = paths.templateFile(brandId, templateId);
    if (!existsSync(file)) return null;
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as Template;
    } catch (err) {
      console.error(`Failed to parse template ${templateId}:`, err);
      return null;
    }
  },

  save(input: Template | NewTemplateInput): Template {
    const id = 'id' in input && input.id ? input.id : randomUUID();
    const existing =
      'id' in input && input.id ? TemplateService.get(input.brandId, input.id) : null;

    const template: Template = {
      ...input,
      id,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };

    paths.ensure(paths.templatesDir(template.brandId));
    writeFileSync(
      paths.templateFile(template.brandId, template.id),
      JSON.stringify(template, null, 2),
      'utf8',
    );
    return template;
  },

  delete(brandId: string, templateId: string): boolean {
    const file = paths.templateFile(brandId, templateId);
    if (!existsSync(file)) return false;
    unlinkSync(file);
    return true;
  },

  duplicate(brandId: string, templateId: string): Template | null {
    const source = TemplateService.get(brandId, templateId);
    if (!source) return null;

    const ts = nowIso();
    const copy: Template = {
      ...source,
      id: randomUUID(),
      name: `${source.name} (copy)`,
      elements: source.elements.map((el) => ({ ...el, id: randomUUID() })),
      createdAt: ts,
      updatedAt: ts,
    };

    paths.ensure(paths.templatesDir(copy.brandId));
    writeFileSync(
      paths.templateFile(copy.brandId, copy.id),
      JSON.stringify(copy, null, 2),
      'utf8',
    );
    return copy;
  },
};
