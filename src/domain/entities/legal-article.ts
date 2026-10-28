import type { ArticleReference } from '../value-objects/article-reference';

export type ArticleStatus = 'in_force' | 'amended' | 'repealed';

export interface LegalArticle {
  readonly reference: ArticleReference;
  readonly text: string;
  readonly status: ArticleStatus;
  /** Optional structural label, e.g. "الكتاب الأول: الالتزامات بوجه عام" */
  readonly bookLabel: string | null;
}
