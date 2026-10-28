import { z } from 'zod';
import type { AppError } from '@/application/errors';
import type { TemplateGateway } from '@/application/ports/templates';
import { ok, type Result } from '@/application/result';
import type { Template, TemplateCategory } from '@/domain/entities/template';
import type { ApiClient } from '@/infrastructure/http/api-client';

const apiTemplateSchema = z.looseObject({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  category: z.string(),
  is_active: z.boolean().nullish(),
});

const CATEGORIES: readonly TemplateCategory[] = [
  'PLEADING',
  'CONTRACT',
  'NOTICE',
  'PETITION',
  'OTHER',
];

/** The catalogue is a few dozen entries; this bounds a runaway `next` chain. */
const MAX_PAGES = 5;

/** "next" is an absolute URL on the backend's own host; only its path and query are reused. */
function localPathOf(next: string): { path: string; query: Record<string, string> } | null {
  try {
    const url = new URL(next);
    return {
      path: url.pathname.replace(/^.*?\/api(?=\/)/, ''),
      query: Object.fromEntries(url.searchParams),
    };
  } catch {
    return null;
  }
}

export class HttpTemplateGateway implements TemplateGateway {
  constructor(private readonly client: ApiClient) {}

  async list(): Promise<Result<readonly Template[], AppError>> {
    const all: Template[] = [];
    let path = '/templates';
    let query: Record<string, string> = {};

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.client.requestPage({ path, query, schema: apiTemplateSchema });
      if (!result.ok) return result;
      for (const api of result.value.items) {
        if (api.is_active === false) continue;
        const category = api.category.toUpperCase() as TemplateCategory;
        all.push({
          code: api.code,
          name: api.name,
          description: api.description?.trim() ?? '',
          // An unknown category is treated as paperwork rather than hidden.
          category: CATEGORIES.includes(category) ? category : 'OTHER',
        });
      }
      const next = result.value.next ? localPathOf(result.value.next) : null;
      if (!next) break;
      ({ path, query } = next);
    }
    return ok(all);
  }
}
