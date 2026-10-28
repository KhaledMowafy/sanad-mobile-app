import { List, Plus } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import type { MessageDto, TemplateDto, UsageSnapshotDto } from '@/application/dto/dto';
import { IconButton } from '@/components/ui/icon-button';
import { AppText } from '@/components/ui/text';
import { UseCaseCards, type UseCaseKey } from '@/components/use-case-cards';
import { isWizardTemplate, type TemplateGroup } from '@/domain/entities/template';
import { useT } from '@/i18n/use-t';
import { createChatStore, type ChatStore } from '@/presentation/chat/chat-store';
import { ASK_MODE, type ComposerMode } from '@/presentation/chat/composer-mode';
import { streamChat } from '@/presentation/chat/stream-client';
import { useConversations } from '@/stores/conversations-store';
import { useLimits } from '@/stores/limits-store';
import { useUi } from '@/stores/ui-store';
import { useTheme } from '@/theme/theme';
import { Composer } from './composer';
import { EmptyState } from './empty-state';
import { TemplatePicker } from './template-picker';
import { Thread } from './thread';

/**
 * One conversation, or the empty state when there is none yet. The store is created once per
 * mount; the route mounts a fresh view when another conversation is opened.
 */
export function ChatView({
  conversationId,
  initialMessages,
  title,
  usage = null,
  userName,
  evening,
  onConversationCreated,
  onNewChat,
}: {
  conversationId: string | null;
  initialMessages: MessageDto[];
  title: string | null;
  usage?: UsageSnapshotDto | null;
  userName: string;
  evening: boolean;
  onConversationCreated: (id: string) => void;
  onNewChat: () => void;
}) {
  const t = useT('chat');
  const { colors, locale } = useTheme();
  const insets = useSafeAreaInsets();
  const limits = useLimits((s) => s.limits);
  const openSidebar = useUi((s) => s.openSidebar);
  const refreshHistory = useConversations((s) => s.refresh);

  const [store] = useState<ChatStore>(() =>
    createChatStore({
      conversationId,
      messages: initialMessages,
      locale,
      limits,
      usage,
      stream: streamChat,
      onConversationCreated,
      // Pulls the new or re-ordered conversation into the sidebar.
      onSettled: () => void refreshHistory(),
    }),
  );

  const messages = useStore(store, (s) => s.messages);
  const phase = useStore(store, (s) => s.phase);
  const attachments = useStore(store, (s) => s.attachments);
  const uploading = useStore(store, (s) => s.uploading);
  const uploadProgress = useStore(store, (s) => s.uploadProgress);
  const attachmentError = useStore(store, (s) => s.attachmentError);
  const drafts = useStore(store, (s) => s.drafts);
  const draftBusy = useStore(store, (s) => s.draftBusy);
  const draftError = useStore(store, (s) => s.draftError);
  const currentUsage = useStore(store, (s) => s.usage);
  const streaming = phase === 'streaming';

  useEffect(() => {
    void store.getState().loadDrafts();
    void store.getState().loadFileCount();
    return () => store.getState().dispose();
  }, [store]);

  const [mode, setMode] = useState<ComposerMode>(ASK_MODE);
  const [picker, setPicker] = useState<{ open: boolean; group: TemplateGroup | null }>({
    open: false,
    group: null,
  });

  const send = (text: string, options?: { mode?: ComposerMode }) => {
    void store.getState().send(text, options);
    // A memo, a document or a review is asked for once; the next message is an ordinary question.
    if (options?.mode && options.mode.kind !== 'ask') setMode(ASK_MODE);
  };

  /** What each card does here: pick how Send behaves, or open the list of documents. */
  const pickUseCase = (key: UseCaseKey) => {
    if (key === 'draft') return setPicker({ open: true, group: 'contract' });
    if (key === 'notice') return setPicker({ open: true, group: 'paperwork' });
    setMode(key === 'memo' ? { kind: 'memo' } : key === 'review' ? { kind: 'review' } : ASK_MODE);
  };

  const pickTemplate = (template: TemplateDto) => {
    if (isWizardTemplate(template)) void store.getState().startContract(template);
    else setMode({ kind: 'template', template });
  };

  const composer = useMemo(
    () => (
      <Composer
        onSend={send}
        onStop={() => store.getState().stop()}
        streaming={streaming}
        attachments={attachments}
        uploading={uploading}
        uploadProgress={uploadProgress}
        attachmentError={attachmentError ?? draftError}
        usage={currentUsage}
        draftBusy={draftBusy}
        mode={mode}
        onModeChange={setMode}
        onOpenTemplates={() => setPicker({ open: true, group: null })}
        onAttach={(files) => void store.getState().attach(files)}
        onDetach={(fileId) => store.getState().detach(fileId)}
        onNewConversation={onNewChat}
      />
    ),
    // `send` only closes over the store and the mode setter, both stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [streaming, attachments, uploading, uploadProgress, attachmentError, draftError, currentUsage, draftBusy, mode],
  );

  const empty = messages.length === 0 && drafts.length === 0;

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <IconButton label={t('openMenu')} onPress={openSidebar}>
          <List size={22} color={colors.textMuted} />
        </IconButton>
        <AppText variant="h4" numberOfLines={1} style={styles.title} accessibilityRole="header">
          {title ?? t('newChat')}
        </AppText>
        <IconButton label={t('newChat')} onPress={onNewChat}>
          <Plus size={22} color={colors.textMuted} />
        </IconButton>
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {empty ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
            <EmptyState
              name={userName}
              evening={evening}
              onAsk={(question) => send(question)}
              cards={<UseCaseCards onPick={pickUseCase} showHints />}
            >
              {composer}
            </EmptyState>
          </ScrollView>
        ) : (
          <>
            <Thread messages={messages} drafts={drafts} />
            <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}>{composer}</View>
          </>
        )}
      </KeyboardAvoidingView>

      <TemplatePicker
        open={picker.open}
        group={picker.group}
        onClose={() => setPicker((current) => ({ ...current, open: false }))}
        onPick={pickTemplate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 56,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1 },
  dock: { paddingHorizontal: 12, paddingTop: 8 },
});
