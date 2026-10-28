import type { SessionStore } from '@/application/ports/auth';
import type { Clock, IdGenerator } from '@/application/ports/platform';
import { GetArticle, SubmitFeedback } from '@/application/use-cases/articles-and-feedback';
import {
  ListAttachments,
  StartConversation,
  UploadAttachment,
} from '@/application/use-cases/attachments';
import {
  GetCurrentUser,
  RequestPasswordReset,
  ResendVerification,
  ResetPassword,
  SignIn,
  SignOut,
  SignUp,
  VerifyEmail,
} from '@/application/use-cases/auth';
import {
  GetCatalogue,
  GetPayment,
  GetSubscription,
  ListPayments,
  StartCheckout,
} from '@/application/use-cases/billing';
import {
  DeleteConversation,
  ExportConversation,
  GetConversation,
  ListConversations,
  RenameConversation,
  SearchConversations,
} from '@/application/use-cases/conversations';
import { CreateDraft, DownloadDraft, GetDraft, ListDrafts } from '@/application/use-cases/drafts';
import { GetLimits } from '@/application/use-cases/limits';
import { GetProfile } from '@/application/use-cases/profile';
import { RegenerateAnswer } from '@/application/use-cases/regenerate-answer';
import { SendMessage } from '@/application/use-cases/send-message';
import { StopGeneration } from '@/application/use-cases/stop-generation';
import { StreamAnswer } from '@/application/use-cases/stream-answer';
import { ListTemplates, StartContractWizard } from '@/application/use-cases/templates';
import { HttpAttachmentGateway } from '../adapters/http/http-attachment-gateway';
import { HttpAuthService } from '../adapters/http/http-auth-service';
import { HttpBillingGateway } from '../adapters/http/http-billing-gateway';
import { HttpChatGateway } from '../adapters/http/http-chat-gateway';
import { HttpConversationRepository } from '../adapters/http/http-conversation-repository';
import { HttpDraftGateway } from '../adapters/http/http-draft-gateway';
import { HttpLimitsGateway } from '../adapters/http/http-limits-gateway';
import { HttpLegalTextRepository } from '../adapters/http/http-pending-adapters';
import { HttpProfileGateway } from '../adapters/http/http-profile-gateway';
import { HttpTemplateGateway } from '../adapters/http/http-template-gateway';
import { API_URL, REQUEST_TIMEOUT_MS, STREAM_TIMEOUT_MS } from '../config';
import { ApiClient } from '../http/api-client';
import { SecureSessionStore } from '../session/secure-session-store';
import { SessionTokens } from '../session/token-provider';

/** What the screens listen to: the backend refused the refresh token, so the person must sign in again. */
const expiredListeners = new Set<() => void>();
export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

const clock: Clock = { now: () => new Date() };

/** Random enough for the ids of messages that exist only on this phone until the backend names them. */
const ids: IdGenerator = {
  next: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }),
};

function build() {
  const session: SessionStore = new SecureSessionStore();
  const tokens = new SessionTokens(session, API_URL, REQUEST_TIMEOUT_MS, () =>
    expiredListeners.forEach((listener) => listener()),
  );
  const client = new ApiClient({
    baseUrl: API_URL,
    timeoutMs: REQUEST_TIMEOUT_MS,
    streamTimeoutMs: STREAM_TIMEOUT_MS,
    tokens,
  });

  const auth = new HttpAuthService(client, session);
  const conversations = new HttpConversationRepository(client);
  const legalTexts = new HttpLegalTextRepository(client);
  const chat = new HttpChatGateway(client);
  const attachments = new HttpAttachmentGateway(client);
  const drafts = new HttpDraftGateway(client);
  const limits = new HttpLimitsGateway(client);
  const profile = new HttpProfileGateway(client);
  const templates = new HttpTemplateGateway(client);
  const billing = new HttpBillingGateway(client);

  return {
    session,
    useCases: {
      signIn: new SignIn(auth),
      signUp: new SignUp(auth),
      verifyEmail: new VerifyEmail(auth),
      resendVerification: new ResendVerification(auth),
      requestPasswordReset: new RequestPasswordReset(auth),
      resetPassword: new ResetPassword(auth),
      signOut: new SignOut(auth),
      getCurrentUser: new GetCurrentUser(auth),
      listConversations: new ListConversations(conversations, clock),
      searchConversations: new SearchConversations(conversations, clock),
      getConversation: new GetConversation(conversations),
      renameConversation: new RenameConversation(conversations),
      deleteConversation: new DeleteConversation(conversations),
      exportConversation: new ExportConversation(conversations),
      sendMessage: new SendMessage(clock, ids),
      streamAnswer: new StreamAnswer(chat, clock, ids),
      stopGeneration: new StopGeneration(),
      regenerateAnswer: new RegenerateAnswer(conversations),
      startConversation: new StartConversation(conversations),
      listAttachments: new ListAttachments(attachments),
      uploadAttachment: new UploadAttachment(attachments, conversations),
      getArticle: new GetArticle(legalTexts),
      submitFeedback: new SubmitFeedback(chat),
      createDraft: new CreateDraft(drafts, conversations),
      getDraft: new GetDraft(drafts),
      listDrafts: new ListDrafts(drafts),
      downloadDraft: new DownloadDraft(drafts),
      getLimits: new GetLimits(limits),
      getProfile: new GetProfile(profile),
      getCatalogue: new GetCatalogue(billing),
      getSubscription: new GetSubscription(billing),
      startCheckout: new StartCheckout(billing),
      getPayment: new GetPayment(billing),
      listPayments: new ListPayments(billing),
      listTemplates: new ListTemplates(templates),
      startContractWizard: new StartContractWizard(drafts, conversations),
    },
  };
}

export type Container = ReturnType<typeof build>;

let instance: Container | undefined;

/** The composition root: the only place that knows which adapters sit behind the ports. */
export function getContainer(): Container {
  instance ??= build();
  return instance;
}
