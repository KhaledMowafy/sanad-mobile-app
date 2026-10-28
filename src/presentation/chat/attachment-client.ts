import type { ChatAttachmentDto, UsageSnapshotDto } from '@/application/dto/dto';
import { problemOf, loadUseCases } from './backend';

/** A file the person picked, still on the disk of the phone. */
export interface PickedFile {
  readonly uri: string;
  readonly name: string;
  readonly size: number;
  readonly mimeType?: string | undefined;
}

export type UploadOutcome =
  | { ok: true; conversationId: string; attachment: ChatAttachmentDto }
  | { ok: false; code: string; usage?: UsageSnapshotDto | null | undefined };

export interface AttachmentApi {
  /** Uploads a file, starting the conversation first when there is none. */
  upload(conversationId: string | null, file: PickedFile): Promise<UploadOutcome>;
  /** Current state of every attachment in the conversation, or null if it could not be read. */
  list(conversationId: string): Promise<ChatAttachmentDto[] | null>;
}

export const attachmentApi: AttachmentApi = {
  async upload(conversationId, file) {
    const { File } = await import('expo-file-system');
    const cases = await loadUseCases();
    // The body is a Blob that points at the picked file, so it streams from disk when sent.
    const result = await cases.uploadAttachment.execute({
      conversationId,
      file: {
        name: file.name,
        type: file.mimeType ?? 'application/octet-stream',
        size: file.size,
        body: new File(file.uri),
      },
    });
    if (!result.ok) return { ok: false, ...problemOf(result.error) };
    return { ok: true, ...result.value };
  },

  async list(conversationId) {
    const result = await (await loadUseCases()).listAttachments.execute(conversationId);
    return result.ok ? result.value : null;
  },
};
