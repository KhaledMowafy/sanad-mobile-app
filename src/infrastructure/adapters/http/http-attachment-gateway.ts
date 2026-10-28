import { z } from 'zod';
import type { AppError } from '@/application/errors';
import type { AttachmentGateway, UploadFile } from '@/application/ports/attachments';
import { ok, type Result } from '@/application/result';
import type { ChatAttachment } from '@/domain/entities/chat-attachment';
import type { ApiClient } from '@/infrastructure/http/api-client';
import { apiAttachmentSchema } from '@/infrastructure/http/api-schemas';
import { toChatAttachment } from './mappers';

const listSchema = z.array(apiAttachmentSchema);

export class HttpAttachmentGateway implements AttachmentGateway {
  constructor(private readonly client: ApiClient) {}

  async list(conversationId: string): Promise<Result<readonly ChatAttachment[], AppError>> {
    const result = await this.client.request({
      path: `/conversations/${encodeURIComponent(conversationId)}/attachments`,
      schema: listSchema,
    });
    return result.ok ? ok(result.value.map(toChatAttachment)) : result;
  }

  async upload(
    conversationId: string,
    file: UploadFile,
  ): Promise<Result<ChatAttachment, AppError>> {
    const form = new FormData();
    // The backend reads the field named "file" and judges the type by the file name.
    form.append('file', file.body, file.name);

    const result = await this.client.request({
      method: 'POST',
      path: `/conversations/${encodeURIComponent(conversationId)}/attachments`,
      body: form,
      schema: apiAttachmentSchema,
    });
    return result.ok ? ok(toChatAttachment(result.value)) : result;
  }
}
