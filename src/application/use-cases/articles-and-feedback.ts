import { ArticleReference } from '@/domain/value-objects/article-reference';
import type { Feedback } from '@/domain/value-objects/feedback';
import { FieldValidator, type AppError } from '../errors';
import type { ArticleDto } from '../dto/dto';
import { toArticleDto } from '../dto/mappers';
import type { ChatGateway } from '../ports/chat-gateway';
import type { LegalTextRepository } from '../ports/repositories';
import { err, ok, type Result } from '../result';

export class GetArticle {
  constructor(private readonly legalTexts: LegalTextRepository) {}

  async execute(input: {
    lawName: string;
    lawNumber: number | null;
    lawYear: number | null;
    article: string;
  }): Promise<Result<ArticleDto, AppError>> {
    const validator = new FieldValidator();
    const reference = validator.run('article', () =>
      ArticleReference.create(
        { name: input.lawName, number: input.lawNumber, year: input.lawYear },
        input.article,
      ),
    );
    if (!reference) return err(validator.toError());

    const result = await this.legalTexts.getArticle(reference);
    return result.ok ? ok(toArticleDto(result.value)) : result;
  }
}

export class SubmitFeedback {
  constructor(private readonly gateway: ChatGateway) {}

  execute(input: {
    conversationId: string;
    messageId: string;
    feedback: Feedback | null;
  }): Promise<Result<void, AppError>> {
    return this.gateway.submitFeedback(input);
  }
}
