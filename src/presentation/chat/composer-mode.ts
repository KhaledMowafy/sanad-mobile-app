import type { TemplateDto } from '@/application/dto/dto';

/**
 * What Send does. The person chooses it, from a card or the composer's own controls; it is never
 * guessed from the wording.
 *  - ask: an ordinary question, answered in the chat.
 *  - memo: a defence memo, built in the background and delivered as a Word file.
 *  - review: the contract in the text or the attachments, reviewed clause by clause in the chat.
 *  - template: a document from the catalogue (notice, request, certificate, contract) built from
 *    what is typed and attached, delivered as a Word file.
 */
export type ComposerMode =
  | { readonly kind: 'ask' }
  | { readonly kind: 'memo' }
  | { readonly kind: 'review' }
  | { readonly kind: 'template'; readonly template: TemplateDto };

export const ASK_MODE: ComposerMode = { kind: 'ask' };
