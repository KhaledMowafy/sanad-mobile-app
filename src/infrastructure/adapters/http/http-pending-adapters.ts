import type { AppError } from '@/application/errors';
import type { LegalTextRepository } from '@/application/ports/repositories';
import { err, ok, type Result } from '@/application/result';
import type { LegalArticle } from '@/domain/entities/legal-article';
import type { ArticleReference } from '@/domain/value-objects/article-reference';
import type { ApiClient } from '@/infrastructure/http/api-client';
import { apiArticleSchema } from '@/infrastructure/http/api-schemas';
import { toLegalArticle } from './mappers';

/** Looks an article up by law name and number with GET /articles?law_name=&number=. */
export class HttpLegalTextRepository implements LegalTextRepository {
  constructor(private readonly client: ApiClient) {}

  async getArticle(reference: ArticleReference): Promise<Result<LegalArticle, AppError>> {
    // The API filters by an integer number; suffixed articles ("147 مكرر") are matched by their
    // leading number and then by label below.
    const number = Number.parseInt(reference.article, 10);
    if (!Number.isFinite(number)) return err({ kind: 'not_found' });

    const result = await this.client.requestPage({
      path: '/articles',
      query: { law_name: reference.law.name, number },
      schema: apiArticleSchema,
    });
    if (!result.ok) return result;

    const candidates = result.value.items
      .map((item) => toLegalArticle(item))
      .filter((article) => article.reference.article === reference.article);
    // Drafts are not authoritative text. TODO: confirm the full status enum.
    const raw = result.value.items;
    const published = candidates.filter(
      (_article, index) => raw[index]?.status.toUpperCase() !== 'DRAFT',
    );
    const best = published[0] ?? candidates[0];
    return best ? ok(best) : err({ kind: 'not_found' });
  }
}
