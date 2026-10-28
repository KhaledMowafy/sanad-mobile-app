import type { Citation } from '@/domain/entities/citation';
import type { Conversation } from '@/domain/entities/conversation';
import type { Message } from '@/domain/entities/message';
import type { User } from '@/domain/entities/user';
import { ArticleReference } from '@/domain/value-objects/article-reference';

export const CIVIL_CODE = { name: 'القانون المدني', number: 131, year: 1948 } as const;

export function articleRef(article = '147'): ArticleReference {
  return ArticleReference.create(CIVIL_CODE, article);
}

export function citation(article = '147', overrides: Partial<Citation> = {}): Citation {
  return {
    id: `cit-${article}`,
    reference: articleRef(article),
    status: 'in_force',
    text: 'العقد شريعة المتعاقدين',
    bookLabel: null,
    ...overrides,
  };
}

export function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    role: 'user',
    content: 'سؤال',
    citations: [],
    references: [],
    attachments: [],
    status: 'complete',
    errorCode: null,
    createdAt: new Date('2026-10-15T10:00:00Z'),
    feedback: null,
    warning: null,
    usage: null,
    ...overrides,
  };
}

export function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    title: 'فسخ عقد شقة لعدم التسليم',
    messages: [],
    createdAt: new Date('2026-10-15T09:00:00Z'),
    updatedAt: new Date('2026-10-15T09:00:00Z'),
    ...overrides,
  };
}

export function user(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    name: 'منى الشربيني',
    email: 'mona@example.com',
    phone: '+201012345678',
    accountKind: 'lawyer',
    barRegistrationNumber: null,
    professionalTitle: 'محامية بالنقض',
    ...overrides,
  };
}
