import type { ArticleReference } from '../value-objects/article-reference';
import type { ArticleStatus } from './legal-article';

/** A source an answer rests on. Renders as a CitationChip and, once opened, a CitationCard. */
export interface Citation {
  readonly id: string;
  readonly reference: ArticleReference;
  readonly status: ArticleStatus;
  /** Null when the backend only sent the reference. Load it with GetArticle. */
  readonly text: string | null;
  readonly bookLabel: string | null;
}
