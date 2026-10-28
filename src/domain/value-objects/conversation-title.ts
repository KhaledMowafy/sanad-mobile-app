import { InvalidConversationTitleError } from '../errors/domain-error';

export const CONVERSATION_TITLE_MAX = 120;
const DERIVED_MAX = 60;
const MIN_WORD_BOUNDARY = 20;

function normalise(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export class ConversationTitle {
  private constructor(readonly value: string) {}

  static create(raw: string): ConversationTitle {
    const value = normalise(raw);
    if (value.length === 0 || value.length > CONVERSATION_TITLE_MAX) {
      throw new InvalidConversationTitleError('Title must be 1 to 120 characters');
    }
    return new ConversationTitle(value);
  }

  /** The first message becomes the title, cut at a word boundary. */
  static fromFirstMessage(content: string): ConversationTitle {
    const text = normalise(content);
    if (text.length <= DERIVED_MAX) return ConversationTitle.create(text);
    const cut = text.slice(0, DERIVED_MAX);
    const lastSpace = cut.lastIndexOf(' ');
    return ConversationTitle.create(lastSpace > MIN_WORD_BOUNDARY ? cut.slice(0, lastSpace) : cut);
  }
}
