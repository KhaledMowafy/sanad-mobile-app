import type { AppError } from '@/application/errors';
import type { AuthService, SignUpData } from '@/application/ports/auth';
import type { ChatEvent, ChatGateway, StreamAnswerRequest } from '@/application/ports/chat-gateway';
import type { Clock, IdGenerator } from '@/application/ports/platform';
import type { ConversationRepository, LegalTextRepository } from '@/application/ports/repositories';
import { err, ok, type Result } from '@/application/result';
import type { Conversation } from '@/domain/entities/conversation';
import type { LegalArticle } from '@/domain/entities/legal-article';
import type { User } from '@/domain/entities/user';
import type { ArticleReference } from '@/domain/value-objects/article-reference';
import type { ConversationTitle } from '@/domain/value-objects/conversation-title';
import type { Email } from '@/domain/value-objects/email';
import type { Password } from '@/domain/value-objects/password';
import type { Feedback } from '@/domain/value-objects/feedback';

export class FixedClock implements Clock {
  constructor(private readonly at = new Date('2026-10-15T10:00:00Z')) {}
  now(): Date {
    return this.at;
  }
}

export class SequentialIds implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `id-${this.n}`;
  }
}

export class FakeChatGateway implements ChatGateway {
  requests: StreamAnswerRequest[] = [];
  feedback: { conversationId: string; messageId: string; feedback: Feedback | null }[] = [];
  feedbackResult: Result<void, AppError> = ok(undefined);

  constructor(
    private readonly script: (signal?: AbortSignal) => AsyncIterable<ChatEvent> = () =>
      toStream([]),
  ) {}

  streamAnswer(request: StreamAnswerRequest, signal?: AbortSignal): AsyncIterable<ChatEvent> {
    this.requests.push(request);
    return this.script(signal);
  }

  submitFeedback(input: {
    conversationId: string;
    messageId: string;
    feedback: Feedback | null;
  }): Promise<Result<void, AppError>> {
    this.feedback.push(input);
    return Promise.resolve(this.feedbackResult);
  }
}

export async function* toStream(events: ChatEvent[]): AsyncGenerator<ChatEvent> {
  for (const event of events) yield event;
}

export class FakeConversationRepository implements ConversationRepository {
  renamed: { id: string; title: string }[] = [];
  removed: string[] = [];
  searched: string[] = [];
  failWith: AppError | null = null;

  constructor(public conversations: Conversation[] = []) {}

  private fail<T>(): Result<T, AppError> | null {
    return this.failWith ? err(this.failWith) : null;
  }

  list(): Promise<Result<readonly Conversation[], AppError>> {
    return Promise.resolve(this.fail() ?? ok(this.conversations));
  }

  get(id: string): Promise<Result<Conversation, AppError>> {
    const failure = this.fail<Conversation>();
    if (failure) return Promise.resolve(failure);
    const found = this.conversations.find((c) => c.id === id);
    return Promise.resolve(found ? ok(found) : err({ kind: 'not_found' }));
  }

  search(query: string): Promise<Result<readonly Conversation[], AppError>> {
    this.searched.push(query);
    return Promise.resolve(
      this.fail() ?? ok(this.conversations.filter((c) => c.title.includes(query))),
    );
  }

  rename(id: string, title: ConversationTitle): Promise<Result<void, AppError>> {
    this.renamed.push({ id, title: title.value });
    return Promise.resolve(this.fail<void>() ?? ok(undefined));
  }

  created: (string | null)[] = [];

  create(title: ConversationTitle | null): Promise<Result<Conversation, AppError>> {
    this.created.push(title?.value ?? null);
    const conversation: Conversation = {
      id: `new-${this.created.length}`,
      title: title?.value ?? 'محادثة جديدة',
      messages: [],
      createdAt: new Date('2026-10-15T10:00:00Z'),
      updatedAt: new Date('2026-10-15T10:00:00Z'),
    };
    this.conversations = [conversation, ...this.conversations];
    return Promise.resolve(this.fail<Conversation>() ?? ok(conversation));
  }

  remove(id: string): Promise<Result<void, AppError>> {
    this.removed.push(id);
    return Promise.resolve(this.fail<void>() ?? ok(undefined));
  }
}

export class FakeLegalTextRepository implements LegalTextRepository {
  constructor(private readonly articles: LegalArticle[] = []) {}

  getArticle(reference: ArticleReference): Promise<Result<LegalArticle, AppError>> {
    const found = this.articles.find((a) => a.reference.equals(reference));
    return Promise.resolve(found ? ok(found) : err({ kind: 'not_found' }));
  }
}

export class FakeAuthService implements AuthService {
  signInCalls: { email: string; password: string }[] = [];
  signUpCalls: SignUpData[] = [];
  verifyCalls: { email: string; code: string }[] = [];
  resendCalls: string[] = [];
  signedOut = 0;
  signUpResult: Result<void, AppError> = ok(undefined);
  verifyResult: Result<void, AppError> = ok(undefined);

  constructor(
    public result: Result<User, AppError>,
    public current: Result<User | null, AppError> = ok(null),
  ) {}

  signIn(email: Email, password: string): Promise<Result<User, AppError>> {
    this.signInCalls.push({ email: email.value, password });
    return Promise.resolve(this.result);
  }

  signUp(data: SignUpData): Promise<Result<void, AppError>> {
    this.signUpCalls.push(data);
    return Promise.resolve(this.signUpResult);
  }

  verifyEmail(email: Email, code: string): Promise<Result<void, AppError>> {
    this.verifyCalls.push({ email: email.value, code });
    return Promise.resolve(this.verifyResult);
  }

  resendVerification(email: Email): Promise<Result<void, AppError>> {
    this.resendCalls.push(email.value);
    return Promise.resolve(ok(undefined));
  }

  resetRequests: string[] = [];
  resetCalls: { email: string; code: string; password: string }[] = [];
  resetResult: Result<void, AppError> = ok(undefined);

  requestPasswordReset(email: Email): Promise<Result<void, AppError>> {
    this.resetRequests.push(email.value);
    return Promise.resolve(ok(undefined));
  }

  resetPassword(email: Email, code: string, password: Password): Promise<Result<void, AppError>> {
    this.resetCalls.push({ email: email.value, code, password: password.value });
    return Promise.resolve(this.resetResult);
  }

  signOut(): Promise<Result<void, AppError>> {
    this.signedOut += 1;
    return Promise.resolve(ok(undefined));
  }

  currentUser(): Promise<Result<User | null, AppError>> {
    return Promise.resolve(this.current);
  }
}
