import type { Attachment } from '@/domain/entities/attachment';
import { createUserMessage } from '@/domain/entities/message';
import type { Locale } from '@/domain/value-objects/locale';
import { FieldValidator, type AppError } from '../errors';
import type { MessageDto } from '../dto/dto';
import { toMessageDto } from '../dto/mappers';
import type { StreamAnswerRequest } from '../ports/chat-gateway';
import type { Clock, IdGenerator } from '../ports/platform';
import { err, ok, type Result } from '../result';

export interface SendMessageInput {
  readonly conversationId: string | null;
  readonly text: string;
  /** Ids of files already uploaded to this conversation and no longer being read. */
  readonly attachmentIds?: readonly string[];
  readonly locale: Locale;
  /** Review the contract instead of answering. Defaults to false. */
  readonly reviewContract?: boolean;
}

export interface SendMessageOutput {
  /** Optimistic user turn to show immediately. */
  readonly userMessage: MessageDto;
  /** Pass to StreamAnswer. */
  readonly request: StreamAnswerRequest;
}

/** Validates the composer input and prepares the user turn. Does not talk to the backend. */
export class SendMessage {
  constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  execute(input: SendMessageInput): Result<SendMessageOutput, AppError> {
    const validator = new FieldValidator();

    // Uploading and reading already happened. Here only the references are carried.
    const attachments: Attachment[] = (input.attachmentIds ?? []).map((id) => ({
      id,
      name: '',
      mimeType: '',
      sizeBytes: 0,
    }));

    const message = validator.run('text', () =>
      createUserMessage({
        id: this.ids.next(),
        content: input.text,
        attachments,
        createdAt: this.clock.now(),
      }),
    );

    if (validator.hasErrors || !message) return err(validator.toError());

    return ok({
      userMessage: toMessageDto(message),
      request: {
        conversationId: input.conversationId,
        content: message.content,
        attachments,
        scope: 'egyptian_legislation',
        locale: input.locale,
        reviewContract: input.reviewContract ?? false,
        regenerateMessageId: null,
      },
    });
  }
}
