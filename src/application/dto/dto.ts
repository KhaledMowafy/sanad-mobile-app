import type { DraftStatus } from '@/domain/entities/draft';
import type { ArticleStatus } from '@/domain/entities/legal-article';
import type { Template } from '@/domain/entities/template';
import type { LibraryReference } from '@/domain/entities/library-reference';
import type { UsageBreakdown } from '@/domain/entities/profile';
import type { TokenCount, UsageSnapshot, UserPeriodUsage } from '@/domain/entities/usage';
import type { AccountKind } from '@/domain/entities/user';
import type { MessageRole, MessageStatus } from '@/domain/entities/message';
import type { RecencyBucket } from '@/domain/services/group-conversations-by-recency';
import type { Feedback } from '@/domain/value-objects/feedback';

/** Plain, serialisable shapes. These cross into presentation and into the client bundle. */

export interface CitationDto {
  id: string;
  lawName: string;
  lawNumber: number | null;
  lawYear: number | null;
  article: string;
  status: ArticleStatus;
  text: string | null;
  bookLabel: string | null;
}

/** Plain already, so the domain shape crosses as it is. */
export type ReferenceDto = LibraryReference;
export type TokenCountDto = TokenCount;
export type UsageSnapshotDto = UsageSnapshot;

export interface ArticleDto {
  lawName: string;
  lawNumber: number | null;
  lawYear: number | null;
  article: string;
  status: ArticleStatus;
  text: string;
  bookLabel: string | null;
}

export interface AttachmentDto {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MessageDto {
  id: string;
  role: MessageRole;
  content: string;
  citations: CitationDto[];
  references: ReferenceDto[];
  attachments: AttachmentDto[];
  status: MessageStatus;
  errorCode: string | null;
  createdAt: string;
  feedback: Feedback | null;
  warning: string | null;
  usage: TokenCountDto | null;
}

export interface ChatAttachmentDto {
  id: string;
  name: string;
  kind: 'image' | 'pdf' | 'word' | 'text';
  sizeBytes: number;
  state: 'queued' | 'reading' | 'ready' | 'failed';
  extractedText: string;
  failed: boolean;
}

export interface ConversationDto {
  id: string;
  title: string;
  messages: MessageDto[];
  createdAt: string;
  updatedAt: string;
  usage: UsageSnapshotDto | null;
}

export interface DraftDto {
  id: string;
  conversationId: string | null;
  templateCode: string | null;
  templateName: string | null;
  prompt: string;
  status: DraftStatus;
  error: string | null;
  warning: string | null;
  output: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface ConversationSummaryDto {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ConversationGroupDto {
  bucket: RecencyBucket;
  items: ConversationSummaryDto[];
}

export interface UserDto {
  id: string;
  name: string;
  firstName: string;
  initial: string;
  email: string;
  phone: string | null;
  accountKind: AccountKind;
  barRegistrationNumber: string | null;
  professionalTitle: string | null;
  usage: UserPeriodUsage | null;
}

export interface ProfileDto {
  user: UserDto;
  role: string | null;
  provider: string | null;
  isVerified: boolean | null;
  isActive: boolean | null;
  createdAt: string | null;
  lastLogin: string | null;
  usage: UsageBreakdown | null;
}

/** Plain already, so the domain shape crosses as it is. */
export type TemplateDto = Template;
