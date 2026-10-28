import type { Conversation } from '../entities/conversation';
import type { Locale } from '../value-objects/locale';

const LABELS: Record<Locale, { you: string; assistant: string; sources: string }> = {
  ar: { you: 'أنت', assistant: 'سندك', sources: 'المراجع' },
  en: { you: 'You', assistant: 'Sanadak', sources: 'Sources' },
};

/** Plain-text transcript with each answer's sources, used for "copy with references" and export. */
export function formatConversationAsText(conversation: Conversation, locale: Locale): string {
  const labels = LABELS[locale];
  const blocks = conversation.messages.map((message) => {
    const speaker = message.role === 'user' ? labels.you : labels.assistant;
    const lines = [`${speaker}:`, message.content];
    if (message.citations.length > 0) {
      lines.push(
        `${labels.sources}:`,
        ...message.citations.map((c) => `- ${c.reference.law.name}, ${c.reference.label(locale)}`),
      );
    }
    return lines.join('\n');
  });
  return [conversation.title, '', ...blocks.flatMap((b) => [b, ''])].join('\n').trimEnd();
}
