import type { Conversation } from '@/domain/entities/conversation';
import type { LegalArticle } from '@/domain/entities/legal-article';
import type { ArticleReference } from '@/domain/value-objects/article-reference';
import type { ConversationTitle } from '@/domain/value-objects/conversation-title';
import type { AppError } from '../errors';
import type { Result } from '../result';

export interface ConversationRepository {
  list(): Promise<Result<readonly Conversation[], AppError>>;
  get(id: string): Promise<Result<Conversation, AppError>>;
  search(query: string): Promise<Result<readonly Conversation[], AppError>>;
  rename(id: string, title: ConversationTitle): Promise<Result<void, AppError>>;
  remove(id: string): Promise<Result<void, AppError>>;
  /** A new, empty conversation. A null title lets the backend name it from the first question. */
  create(title: ConversationTitle | null): Promise<Result<Conversation, AppError>>;
}

export interface LegalTextRepository {
  getArticle(reference: ArticleReference): Promise<Result<LegalArticle, AppError>>;
}
