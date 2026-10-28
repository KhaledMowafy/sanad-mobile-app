import type { Draft } from '@/domain/entities/draft';
import type { Message } from '@/domain/entities/message';
import type { AppError } from '../errors';
import type { Result } from '../result';

export interface DraftDownload {
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly contentType: string;
}

export interface DraftGateway {
  /**
   * Starts a defence memo from a conversation: its user messages, its READY or FAILED files and
   * the typed text. Returns at once; poll `get` until the draft settles.
   */
  create(input: {
    readonly conversationId: string;
    readonly prompt: string;
    readonly attachmentIds: readonly string[];
    /** A template's code. Omit it for a defence memo. */
    readonly templateCode?: string | undefined;
  }): Promise<Result<Draft, AppError>>;
  /**
   * Opens the chat's question-by-question wizard for a template. The first question comes back as
   * the assistant message already stored in the conversation.
   */
  startContract(input: {
    readonly conversationId: string;
    readonly templateCode: string;
  }): Promise<Result<Message, AppError>>;
  /** With the memo text once it is done. */
  get(id: string): Promise<Result<Draft, AppError>>;
  /** The memos asked from a conversation, newest first. The list leaves the memo text out. */
  list(conversationId: string): Promise<Result<readonly Draft[], AppError>>;
  /** The finished memo as a Word document. */
  download(id: string): Promise<Result<DraftDownload, AppError>>;
}
