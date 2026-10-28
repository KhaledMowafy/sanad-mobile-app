import type { Message } from './message';
import type { UsageSnapshot } from './usage';

export interface Conversation {
  readonly id: string;
  readonly title: string;
  readonly messages: readonly Message[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Where the conversation and the account stand against their limits. Detail view only. */
  readonly usage?: UsageSnapshot | undefined;
}

export function renameConversation(conversation: Conversation, title: string): Conversation {
  return { ...conversation, title };
}

export function appendMessage(
  conversation: Conversation,
  message: Message,
  now: Date,
): Conversation {
  return { ...conversation, messages: [...conversation.messages, message], updatedAt: now };
}

export function replaceMessage(conversation: Conversation, message: Message): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((m) => (m.id === message.id ? message : m)),
  };
}

/** The user turn that produced the given assistant message, used to regenerate it. */
export function userMessageBefore(
  conversation: Conversation,
  assistantMessageId: string,
): Message | null {
  const index = conversation.messages.findIndex((m) => m.id === assistantMessageId);
  if (index <= 0) return null;
  for (let i = index - 1; i >= 0; i--) {
    const candidate = conversation.messages[i];
    if (candidate?.role === 'user') return candidate;
  }
  return null;
}
