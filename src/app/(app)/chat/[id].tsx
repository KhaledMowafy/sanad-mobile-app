import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import type { ConversationDto } from '@/application/dto/dto';
import { ChatView } from '@/components/chat/chat-view';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useT } from '@/i18n/use-t';
import { getContainer } from '@/infrastructure/di/container';
import { useAuth } from '@/stores/auth-store';
import { useTheme } from '@/theme/theme';

type Load =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'failed' }
  | { status: 'ready'; conversation: ConversationDto | null };

/** Loads one conversation (or starts an empty one) and mounts a chat view for it. */
function ChatLoader({
  conversationId,
  onCreated,
  onNewChat,
}: {
  conversationId: string | null;
  onCreated: (id: string) => void;
  onNewChat: () => void;
}) {
  const t = useT('chat');
  const mobile = useT('mobile');
  const { colors } = useTheme();
  // The view is remounted for another conversation, so only the id it opened with counts.
  const [opened] = useState(conversationId);
  const user = useAuth((s) => s.user);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>(
    opened === null ? { status: 'ready', conversation: null } : { status: 'loading' },
  );

  useEffect(() => {
    if (opened === null) return;
    let cancelled = false;
    void getContainer()
      .useCases.getConversation.execute(opened)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setLoad({ status: 'ready', conversation: result.value });
        else setLoad({ status: result.error.kind === 'not_found' ? 'missing' : 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [opened, attempt]);

  if (load.status === 'loading') {
    return (
      <Screen contentStyle={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (load.status === 'missing' || load.status === 'failed') {
    return (
      <Screen contentStyle={styles.center}>
        <Banner tone="error">
          {load.status === 'missing' ? t('errors.not_found') : mobile('unavailable')}
        </Banner>
        {load.status === 'failed' ? (
          <Button
            label={mobile('retry')}
            onPress={() => {
              setLoad({ status: 'loading' });
              setAttempt((n) => n + 1);
            }}
          />
        ) : (
          <Button label={t('newChat')} onPress={onNewChat} />
        )}
      </Screen>
    );
  }

  const { conversation } = load;
  return (
    <ChatView
      conversationId={conversation?.id ?? null}
      initialMessages={conversation?.messages ?? []}
      title={conversation?.title ?? null}
      usage={conversation?.usage ?? null}
      userName={user?.firstName ?? ''}
      evening={new Date().getHours() >= 17}
      onConversationCreated={onCreated}
      onNewChat={onNewChat}
    />
  );
}

/**
 * /chat/new is an empty conversation; /chat/<id> is an existing one. The first answer of a new
 * conversation gives it an id, and the address follows without remounting, so the streamed
 * answer stays on screen. Any other change of id mounts a fresh view.
 */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [nav, setNav] = useState<{ seen: string | undefined; generation: number; created: string | null }>({
    seen: id,
    generation: 0,
    created: null,
  });

  if (id !== nav.seen) {
    // The id the view itself just created is not a navigation; any other change is.
    setNav(
      id === nav.created
        ? { ...nav, seen: id }
        : { seen: id, generation: nav.generation + 1, created: null },
    );
  }

  return (
    <ChatLoader
      key={nav.generation}
      conversationId={id && id !== 'new' ? id : null}
      onCreated={(newId) => {
        setNav((current) => ({ ...current, created: newId }));
        router.setParams({ id: newId });
      }}
      onNewChat={() => {
        setNav((current) => ({ ...current, created: null }));
        router.navigate('/chat/new');
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: 16, padding: 24 },
});
