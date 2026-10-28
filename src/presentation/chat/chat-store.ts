import { createStore } from 'zustand/vanilla';
import type {
  ChatAttachmentDto,
  DraftDto,
  MessageDto,
  TemplateDto,
  UsageSnapshotDto,
} from '@/application/dto/dto';
import { assertAttachmentAllowed, byNaturalName } from '@/domain/entities/attachment';
import { isReading, isSettled } from '@/domain/entities/chat-attachment';
import { DEFAULT_LIMITS, type UsageLimits } from '@/domain/entities/limits';
import { blockingLimit } from '@/domain/entities/usage';
import { DomainError } from '@/domain/errors/domain-error';
import { attachmentApi, type AttachmentApi, type PickedFile } from './attachment-client';
import { ASK_MODE, type ComposerMode } from './composer-mode';
import { draftApi, type DraftApi } from './draft-client';
import { ChatStreamError, type ChatStreamFn } from './stream-client';
import { templateApi, type TemplateApi } from './template-client';

const POLL_MS = 2500;
const DRAFT_POLL_MS = 4000;

const draftSettled = (draft: DraftDto) => draft.status === 'done' || draft.status === 'failed';

export interface ChatState {
  /** Null until the first answer, upload or memo creates the conversation. */
  conversationId: string | null;
  messages: MessageDto[];
  phase: 'idle' | 'streaming';
  /** Files uploaded for the next question, with what the backend read from each. */
  attachments: ChatAttachmentDto[];
  /** A stable code for the last attachment problem, cleared by the next action. */
  attachmentError: string | null;
  /** True while a file is on its way to the backend. */
  uploading: boolean;
  /** Which file of the batch is on its way, while several are being uploaded. */
  uploadProgress: { done: number; total: number } | null;
  /** Every file in the conversation so far. The backend caps the whole conversation, not a turn. */
  conversationFiles: number;
  /** Defence memos asked from this conversation. They are documents, not chat messages. */
  drafts: DraftDto[];
  /** True while a memo request is on its way to the backend. */
  draftBusy: boolean;
  /** A stable code for the last memo problem. */
  draftError: string | null;
  /** Where the conversation and the month stand against their limits. */
  usage: UsageSnapshotDto | null;
  /** Sends in the chosen mode: a question, a review, or a request for a Word document. */
  send: (text: string, options?: { mode?: ComposerMode }) => Promise<void>;
  /** Opens the question-by-question wizard for a contract template. */
  startContract: (template: TemplateDto) => Promise<void>;
  stop: () => void;
  attach: (files: readonly PickedFile[]) => Promise<void>;
  detach: (id: string) => void;
  /** Counts the files already in a reopened conversation, so the room left is known. */
  loadFileCount: () => Promise<void>;
  /** Loads the memos of a reopened conversation. */
  loadDrafts: () => Promise<void>;
  /** Stops polling. Call when the view goes away. */
  dispose: () => void;
}

export interface ChatStoreOptions {
  conversationId: string | null;
  messages: MessageDto[];
  locale: 'ar' | 'en';
  stream: ChatStreamFn;
  attachmentApi?: AttachmentApi;
  draftApi?: DraftApi;
  templateApi?: TemplateApi;
  limits?: UsageLimits;
  usage?: UsageSnapshotDto | null;
  /** Called once, when a brand new conversation gets its id. */
  onConversationCreated?: (id: string) => void;
  /** Called when an answer finishes in any way, so the sidebar can refresh. */
  onSettled?: () => void;
  now?: () => Date;
  pollMs?: number;
  draftPollMs?: number;
}

export type ChatStore = ReturnType<typeof createChatStore>;

export function createChatStore(options: ChatStoreOptions) {
  const now = options.now ?? (() => new Date());
  const files = options.attachmentApi ?? attachmentApi;
  const memos = options.draftApi ?? draftApi;
  const templates = options.templateApi ?? templateApi;
  const limits = options.limits ?? DEFAULT_LIMITS;
  const pollMs = options.pollMs ?? POLL_MS;
  const draftPollMs = options.draftPollMs ?? DRAFT_POLL_MS;
  let controller: AbortController | null = null;
  let counter = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let uploadChain: Promise<void> = Promise.resolve();
  let announced = options.conversationId !== null;

  return createStore<ChatState>()((set, get) => {
    const patchLast = (patch: (message: MessageDto) => MessageDto) =>
      set((state) => {
        const messages = [...state.messages];
        const last = messages.at(-1);
        if (last) messages[messages.length - 1] = patch(last);
        return { messages };
      });

    const announce = (id: string) => {
      if (announced) return;
      announced = true;
      options.onConversationCreated?.(id);
    };

    const stopPolling = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    /** Refreshes pending files until none is queued or being read. */
    const poll = () => {
      stopPolling();
      if (disposed) return;
      const { conversationId, attachments } = get();
      if (!conversationId || !attachments.some(isReading)) return;

      timer = setTimeout(async () => {
        const fresh = await files.list(conversationId);
        if (disposed) return;
        if (fresh) {
          set((state) => ({
            attachments: state.attachments.map(
              (item) => fresh.find((candidate) => candidate.id === item.id) ?? item,
            ),
          }));
        }
        poll();
      }, pollMs);
    };

    /** Refreshes every memo that is still being written, every few seconds. */
    const pollDrafts = () => {
      if (draftTimer) clearTimeout(draftTimer);
      draftTimer = null;
      if (disposed || !get().drafts.some((d) => !draftSettled(d))) return;

      draftTimer = setTimeout(async () => {
        const waiting = get().drafts.filter((d) => !draftSettled(d));
        const fresh = await Promise.all(waiting.map((d) => memos.get(d.id)));
        if (disposed) return;
        set((state) => ({
          drafts: state.drafts.map((draft) => {
            const index = waiting.findIndex((w) => w.id === draft.id);
            return (index >= 0 ? fresh[index] : null) ?? draft;
          }),
        }));
        pollDrafts();
      }, draftPollMs);
    };

    /** A contract finished by the wizard is drafted in the background: show it like a memo. */
    const followDraft = async (id: string) => {
      const draft = await memos.get(id);
      if (disposed || !draft || get().drafts.some((d) => d.id === id)) return;
      set((state) => ({ drafts: [...state.drafts, draft] }));
      pollDrafts();
    };

    const adoptUsage = (usage: UsageSnapshotDto | null | undefined) => {
      if (usage) set({ usage });
    };

    const requestMemo = async (text: string, templateCode?: string) => {
      if (get().draftBusy) return;
      const pending = get().attachments;
      if (pending.some(isReading) || get().uploading) {
        set({ attachmentError: 'attachments_pending' });
        return;
      }
      if (blockingLimit(get().usage, { memo: true })) {
        set({ draftError: 'limit_monthly_tokens' });
        return;
      }
      const sent = pending.filter(isSettled);
      if (text.length === 0 && sent.length === 0 && get().conversationId === null) {
        set({ draftError: 'message_empty' });
        return;
      }

      set({ draftBusy: true, draftError: null, attachmentError: null });
      const outcome = await memos.create({
        conversationId: get().conversationId,
        prompt: text,
        attachmentIds: sent.map((a) => a.id),
        ...(templateCode ? { templateCode } : {}),
      });
      if (disposed) return;
      set({ draftBusy: false });

      if (!outcome.ok) {
        set({ draftError: outcome.code });
        adoptUsage(outcome.usage);
        return;
      }
      set((state) => ({
        conversationId: outcome.conversationId,
        drafts: [...state.drafts, outcome.draft],
        // The files belong to the memo now, as they would to a question.
        attachments: [],
      }));
      stopPolling();
      announce(outcome.conversationId);
      options.onSettled?.();
      pollDrafts();
    };

    return {
      conversationId: options.conversationId,
      messages: options.messages,
      phase: 'idle',
      attachments: [],
      attachmentError: null,
      uploading: false,
      uploadProgress: null,
      conversationFiles: 0,
      drafts: [],
      draftBusy: false,
      draftError: null,
      usage: options.usage ?? null,

      stop: () => controller?.abort(),

      dispose: () => {
        disposed = true;
        stopPolling();
        if (draftTimer) clearTimeout(draftTimer);
        draftTimer = null;
      },

      detach: (id) =>
        set((state) => ({
          attachments: state.attachments.filter((item) => item.id !== id),
          attachmentError: null,
        })),

      loadDrafts: async () => {
        const id = get().conversationId;
        if (!id) return;
        const listed = await memos.list(id);
        if (disposed || !listed) return;
        // The list leaves the memo text out, so each finished memo is read for its preview.
        const full = await Promise.all(
          listed.map((draft) => (draft.status === 'done' ? memos.get(draft.id) : null)),
        );
        if (disposed) return;
        const known = new Set(get().drafts.map((d) => d.id));
        const loaded = listed
          .map((draft, index) => full[index] ?? draft)
          // Oldest first, like the thread.
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .filter((draft) => !known.has(draft.id));
        set((state) => ({ drafts: [...loaded, ...state.drafts] }));
        pollDrafts();
      },

      loadFileCount: async () => {
        const id = get().conversationId;
        if (!id) return;
        const listed = await files.list(id);
        if (disposed || !listed) return;
        set({ conversationFiles: listed.length });
      },

      attach: (picked) => {
        // One batch at a time: a paste or a drop during an upload waits its turn.
        const run = async () => {
          set({ attachmentError: null });
          const ordered = [...picked].sort(byNaturalName);
          if (ordered.length === 0) return;

          // All or nothing. Half a case uploaded reads as the whole of it, so a choice that does
          // not fit in the room left, or has one file the backend would refuse, uploads nothing.
          if (ordered.length > limits.attachments.perConversation - get().conversationFiles) {
            set({ attachmentError: 'too_many_attachments' });
            return;
          }
          for (const file of ordered) {
            try {
              assertAttachmentAllowed(
                { name: file.name, sizeBytes: file.size },
                limits.attachments.maxBytes,
              );
            } catch (error) {
              set({
                attachmentError: error instanceof DomainError ? error.code : 'invalid_attachment',
              });
              return;
            }
          }

          set({ uploading: true, uploadProgress: { done: 0, total: ordered.length } });
          for (const [index, file] of ordered.entries()) {
            const outcome = await files.upload(get().conversationId, file);
            if (disposed) return;
            if (!outcome.ok) {
              // A refused upload stops the rest.
              set({ attachmentError: outcome.code });
              adoptUsage(outcome.usage);
              break;
            }
            set((state) => ({
              conversationId: outcome.conversationId,
              attachments: [...state.attachments, outcome.attachment],
              conversationFiles: state.conversationFiles + 1,
              uploadProgress: { done: index + 1, total: ordered.length },
            }));
            announce(outcome.conversationId);
          }
          set({ uploading: false, uploadProgress: null });
          poll();
        };
        uploadChain = uploadChain.then(run, run);
        return uploadChain;
      },

      startContract: async (template) => {
        if (get().phase === 'streaming' || get().draftBusy) return;
        set({ draftBusy: true, draftError: null, attachmentError: null });
        const outcome = await templates.startContract({
          conversationId: get().conversationId,
          templateCode: template.code,
          title: template.name,
        });
        if (disposed) return;
        set({ draftBusy: false });
        if (!outcome.ok) {
          set({ draftError: outcome.code });
          adoptUsage(outcome.usage);
          return;
        }
        // The first question is an assistant message already stored in the conversation. Every
        // answer after it is an ordinary question, which the backend routes to the wizard.
        set((state) => ({
          conversationId: outcome.conversationId,
          messages: [...state.messages, outcome.message],
        }));
        announce(outcome.conversationId);
        options.onSettled?.();
      },

      send: async (raw, sendOptions) => {
        const text = raw.trim();
        const mode = sendOptions?.mode ?? ASK_MODE;
        if (mode.kind === 'memo' || mode.kind === 'template') {
          if (get().phase === 'streaming') return;
          await requestMemo(text, mode.kind === 'template' ? mode.template.code : undefined);
          return;
        }
        if (text.length === 0 || get().phase === 'streaming') return;

        // The backend would refuse these, so they are stopped before anything is sent.
        const blocked = blockingLimit(get().usage);
        if (blocked) {
          set({ attachmentError: `limit_${blocked}` });
          return;
        }
        // The backend rejects a question that points at a file it is still reading.
        const pending = get().attachments;
        if (pending.some(isReading) || get().uploading) {
          set({ attachmentError: 'attachments_pending' });
          return;
        }
        const sent = pending.filter(isSettled);

        counter += 1;
        const stamp = now().toISOString();
        const user: MessageDto = {
          id: `local-user-${counter}`,
          role: 'user',
          content: text,
          citations: [],
          references: [],
          attachments: sent.map((a) => ({
            id: a.id,
            name: a.name,
            mimeType: '',
            sizeBytes: a.sizeBytes,
          })),
          status: 'complete',
          errorCode: null,
          createdAt: stamp,
          feedback: null,
          warning: null,
          usage: null,
        };
        const assistant: MessageDto = {
          ...user,
          id: `local-assistant-${counter}`,
          role: 'assistant',
          content: '',
          attachments: [],
          status: 'streaming',
        };
        set((state) => ({
          messages: [...state.messages, user, assistant],
          phase: 'streaming',
          attachments: [],
          attachmentError: null,
        }));
        stopPolling();

        controller = new AbortController();
        const { signal } = controller;

        try {
          for await (const event of options.stream(
            {
              conversationId: get().conversationId,
              text,
              locale: options.locale,
              reviewContract: mode.kind === 'review',
              attachmentIds: sent.map((a) => a.id),
            },
            signal,
          )) {
            if (event.type === 'delta') {
              patchLast((m) => ({ ...m, content: m.content + event.text }));
            } else if (event.type === 'citation') {
              patchLast((m) =>
                m.citations.some((c) => c.id === event.citation.id)
                  ? m
                  : { ...m, citations: [...m.citations, event.citation] },
              );
            } else if (event.type === 'reference') {
              patchLast((m) =>
                m.references.some((r) => r.id === event.reference.id)
                  ? m
                  : { ...m, references: [...m.references, event.reference] },
              );
            } else if (event.type === 'end') {
              patchLast((m) => ({
                ...m,
                id: event.messageId ?? m.id,
                status: event.status,
                errorCode: event.errorCode,
                warning: event.warning,
                usage: event.usage,
              }));
              adoptUsage(event.snapshot);
              if (event.draftRequestId) void followDraft(event.draftRequestId);
              if (event.conversationId && get().conversationId !== event.conversationId) {
                set({ conversationId: event.conversationId });
              }
            }
          }
          // The stream closed without an "end" frame: the connection dropped.
          patchLast((m) =>
            m.status === 'streaming' ? { ...m, status: 'error', errorCode: 'stream_closed' } : m,
          );
        } catch (error) {
          patchLast((m) => ({
            ...m,
            status: signal.aborted ? 'stopped' : 'error',
            errorCode: signal.aborted
              ? null
              : error instanceof ChatStreamError
                ? error.code
                : 'network',
          }));
        } finally {
          controller = null;
          patchLast((m) => (m.status === 'streaming' ? { ...m, status: 'stopped' } : m));
          set({ phase: 'idle' });
          const id = get().conversationId;
          if (id) announce(id);
          options.onSettled?.();
        }
      },
    };
  });
}
