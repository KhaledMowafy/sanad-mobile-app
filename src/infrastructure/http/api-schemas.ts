import { z } from 'zod';

/**
 * Shapes of the sanadtech API, taken from sample responses.
 * Loose objects: the backend may add fields without breaking the frontend.
 */

export const loginDataSchema = z.looseObject({
  access: z.string().min(1),
  refresh: z.string().min(1),
});

/** Refresh may rotate the refresh token or leave it unchanged. */
export const refreshDataSchema = z.looseObject({
  access: z.string().min(1),
  refresh: z.string().min(1).nullish(),
});

export const apiUserSchema = z.looseObject({
  id: z.number(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  email: z.string(),
  role: z.string().nullish(),
  provider: z.string().nullish(),
  is_active: z.boolean().nullish(),
  is_verified: z.boolean().nullish(),
  created_at: z.string().nullish(),
  last_login: z.string().nullish(),
  /** This month's tokens against the quota. Parsed by usage-mappers. */
  usage: z.unknown().optional(),
});
export type ApiUser = z.infer<typeof apiUserSchema>;

export const apiConversationSchema = z.looseObject({
  id: z.number(),
  title: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
  last_message: z.string().nullish(),
  message_count: z.number().nullish(),
});
export type ApiConversation = z.infer<typeof apiConversationSchema>;

export const apiArticleSchema = z.looseObject({
  id: z.number(),
  law_name: z.string(),
  number: z.number(),
  is_bis: z.boolean().nullish(),
  bis_label: z.string().nullish(),
  text_ocr: z.string().nullish(),
  text_clean: z.string().nullish(),
  status: z.string(),
  valid_to: z.string().nullish(),
  superseded_by: z.number().nullish(),
});
export type ApiArticle = z.infer<typeof apiArticleSchema>;

export const apiAttachmentSchema = z.looseObject({
  id: z.number(),
  filename: z.string(),
  kind: z.string(),
  size_bytes: z.number().nullish(),
  state: z.string(),
  extraction_method: z.string().nullish(),
  extraction_error: z.string().nullish(),
  chars: z.number().nullish(),
  /** Present on the list endpoint, absent from the upload response. */
  extracted_text: z.string().nullish(),
});
export type ApiAttachment = z.infer<typeof apiAttachmentSchema>;

export const apiMessageSchema = z.looseObject({
  id: z.number(),
  conversation: z.number().nullish(),
  role: z.string(),
  content: z.string().nullish(),
  /** Documented as a string. Parsed defensively in the mapper. */
  citations: z.unknown().optional(),
  warning: z.string().nullish(),
  /** What the reply cost; null on a question. Parsed by usage-mappers. */
  usage: z.unknown().optional(),
  created_at: z.string(),
});
export type ApiMessage = z.infer<typeof apiMessageSchema>;

/** Messages use cursor pagination: {messages, next_cursor, has_more}. */
export const apiMessagesPageSchema = z.looseObject({
  messages: z.array(apiMessageSchema),
  next_cursor: z.string().nullish(),
  has_more: z.boolean().nullish(),
  /** {conversation, user}: where the conversation and the month stand. */
  usage: z.unknown().optional(),
});

/** For endpoints whose "data" we do not read, such as DELETE or logout. */
export const anySchema = z.unknown();
