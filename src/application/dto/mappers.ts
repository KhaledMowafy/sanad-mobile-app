import type { Attachment } from '@/domain/entities/attachment';
import type { ChatAttachment } from '@/domain/entities/chat-attachment';
import type { Citation } from '@/domain/entities/citation';
import type { Conversation } from '@/domain/entities/conversation';
import type { Draft } from '@/domain/entities/draft';
import type { LegalArticle } from '@/domain/entities/legal-article';
import type { AccountProfile } from '@/domain/entities/profile';
import type { Message } from '@/domain/entities/message';
import { avatarInitial, firstName, type User } from '@/domain/entities/user';
import type {
  ArticleDto,
  AttachmentDto,
  ChatAttachmentDto,
  CitationDto,
  ConversationDto,
  ConversationSummaryDto,
  DraftDto,
  MessageDto,
  ProfileDto,
  UserDto,
} from './dto';

export function toCitationDto(citation: Citation): CitationDto {
  return {
    id: citation.id,
    lawName: citation.reference.law.name,
    lawNumber: citation.reference.law.number,
    lawYear: citation.reference.law.year,
    article: citation.reference.article,
    status: citation.status,
    text: citation.text,
    bookLabel: citation.bookLabel,
  };
}

export function toArticleDto(article: LegalArticle): ArticleDto {
  return {
    lawName: article.reference.law.name,
    lawNumber: article.reference.law.number,
    lawYear: article.reference.law.year,
    article: article.reference.article,
    status: article.status,
    text: article.text,
    bookLabel: article.bookLabel,
  };
}

export function toAttachmentDto(attachment: Attachment): AttachmentDto {
  return { ...attachment };
}

export function toMessageDto(message: Message): MessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    citations: message.citations.map(toCitationDto),
    references: [...message.references],
    attachments: message.attachments.map(toAttachmentDto),
    status: message.status,
    errorCode: message.errorCode,
    createdAt: message.createdAt.toISOString(),
    feedback: message.feedback,
    warning: message.warning,
    usage: message.usage,
  };
}

export function toConversationDto(conversation: Conversation): ConversationDto {
  return {
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages.map(toMessageDto),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    usage: conversation.usage ?? null,
  };
}

export function toConversationSummaryDto(conversation: Conversation): ConversationSummaryDto {
  return {
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    firstName: firstName(user),
    initial: avatarInitial(user),
    email: user.email,
    phone: user.phone,
    accountKind: user.accountKind,
    barRegistrationNumber: user.barRegistrationNumber,
    professionalTitle: user.professionalTitle,
    usage: user.usage ?? null,
  };
}

export function toChatAttachmentDto(attachment: ChatAttachment): ChatAttachmentDto {
  return {
    id: attachment.id,
    name: attachment.name,
    kind: attachment.kind,
    sizeBytes: attachment.sizeBytes,
    state: attachment.state,
    extractedText: attachment.extractedText,
    failed: attachment.failed,
  };
}

export function toDraftDto(draft: Draft): DraftDto {
  return {
    id: draft.id,
    conversationId: draft.conversationId,
    templateCode: draft.templateCode,
    templateName: draft.templateName,
    prompt: draft.prompt,
    status: draft.status,
    error: draft.error,
    warning: draft.warning,
    output: draft.output,
    createdAt: draft.createdAt.toISOString(),
    finishedAt: draft.finishedAt?.toISOString() ?? null,
  };
}

export function toProfileDto(profile: AccountProfile): ProfileDto {
  return {
    user: toUserDto(profile.user),
    role: profile.role,
    provider: profile.provider,
    isVerified: profile.isVerified,
    isActive: profile.isActive,
    createdAt: profile.createdAt?.toISOString() ?? null,
    lastLogin: profile.lastLogin?.toISOString() ?? null,
    usage: profile.usage,
  };
}
