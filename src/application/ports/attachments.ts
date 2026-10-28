import type { ChatAttachment } from '@/domain/entities/chat-attachment';
import type { AppError } from '../errors';
import type { Result } from '../result';

/** A picked file. On a phone it is read from disk when it is sent, so `body` is a Blob that points at it. */
export interface UploadFile {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly body: Blob;
}

export interface AttachmentGateway {
  /** Poll this after an upload until nothing is queued or reading. */
  list(conversationId: string): Promise<Result<readonly ChatAttachment[], AppError>>;
  /** Returns at once; reading continues on the backend and shows up in `list`. */
  upload(conversationId: string, file: UploadFile): Promise<Result<ChatAttachment, AppError>>;
}
