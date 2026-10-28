import { useRouter } from 'expo-router';
import {
  CreditCard,
  DotsThree,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SignOut,
  Trash,
  X,
} from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageButton, ThemeButton } from '@/components/prefs-buttons';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Logo } from '@/components/ui/logo';
import { Sheet } from '@/components/ui/sheet';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useT } from '@/i18n/use-t';
import { useAuth } from '@/stores/auth-store';
import { useConversations } from '@/stores/conversations-store';
import { useUi } from '@/stores/ui-store';
import { useTheme } from '@/theme/theme';
import { radius, size } from '@/theme/tokens';
import { MonthUsage } from './usage-strip';

type Pending =
  | { kind: 'rename'; id: string; title: string }
  | { kind: 'delete'; id: string; title: string }
  | null;

/**
 * The conversation list, as a panel that slides in from the start edge: new conversation, search,
 * history grouped by recency with rename and delete, the account and plan links, and sign out.
 */
export function Sidebar({
  activeId,
  onOpen,
  onNew,
}: {
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const t = useT('chat');
  const item = useT('chat.item');
  const mobile = useT('mobile');
  const router = useRouter();
  const { colors, rtl } = useTheme();
  const insets = useSafeAreaInsets();
  const open = useUi((s) => s.sidebarOpen);
  const close = useUi((s) => s.closeSidebar);
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const { groups, query, loading, failed, refresh, setQuery, rename, remove } = useConversations();
  const [pending, setPending] = useState<Pending>(null);
  const [menuFor, setMenuFor] = useState<{ id: string; title: string } | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const go = (run: () => void) => {
    close();
    run();
  };

  const finish = () => {
    setPending(null);
    setBusy(false);
    setProblem(false);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        <View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              backgroundColor: colors.bg,
              paddingTop: insets.top + 8,
              paddingBottom: Math.max(insets.bottom, 12),
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.top}>
            <Logo height={28} />
            <View style={styles.row}>
              <LanguageButton />
              <ThemeButton />
              <IconButton label={mobile('close')} onPress={close} small>
                <X size={18} color={colors.textMuted} />
              </IconButton>
            </View>
          </View>

          <Button
            label={t('newChat')}
            icon={<Plus size={20} color={colors.onPrimary} />}
            onPress={() => go(onNew)}
            block
          />

          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MagnifyingGlass size={16} color={colors.textSubtle} />
            <TextInput
              accessibilityLabel={t('searchLabel')}
              value={query}
              onChangeText={setQuery}
              placeholder={t('searchPlaceholder')}
              placeholderTextColor={colors.textSubtle}
              style={[styles.input, { color: colors.text }]}
            />
          </View>

          <ScrollView
            style={styles.history}
            contentContainerStyle={styles.historyContent}
            keyboardShouldPersistTaps="handled"
          >
            {loading && total === 0 ? (
              <ActivityIndicator color={colors.primary} />
            ) : failed && total === 0 ? (
              <View style={styles.center}>
                <AppText variant="small" tone="error">
                  {mobile('unavailable')}
                </AppText>
                <Button variant="secondary" label={mobile('retry')} onPress={() => void refresh()} />
              </View>
            ) : total === 0 ? (
              <AppText variant="small" tone="muted" style={styles.pad}>
                {query ? t('noResults') : t('emptyHistory')}
              </AppText>
            ) : (
              groups.map((group) => (
                <View key={group.bucket} style={styles.group}>
                  <AppText variant="caption" weight={600} tone="muted" style={styles.pad}>
                    {t(`groups.${group.bucket}`)}
                  </AppText>
                  {group.items.map((conversation) => {
                    const active = conversation.id === activeId;
                    return (
                      <View
                        key={conversation.id}
                        style={[
                          styles.conversation,
                          active ? { backgroundColor: colors.surface, borderColor: colors.border } : null,
                        ]}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={conversation.title}
                          onPress={() => go(() => onOpen(conversation.id))}
                          style={styles.conversationMain}
                        >
                          <AppText
                            variant="small"
                            weight={active ? 600 : 400}
                            numberOfLines={1}
                            tone={active ? 'text' : 'muted'}
                          >
                            {conversation.title}
                          </AppText>
                        </Pressable>
                        <IconButton
                          label={item('options')}
                          small
                          onPress={() => setMenuFor({ id: conversation.id, title: conversation.title })}
                        >
                          <DotsThree size={18} weight="bold" color={colors.textMuted} />
                        </IconButton>
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>

          <MonthUsage usage={user?.usage ?? null} />

          <View style={[styles.account, { borderTopColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mobile('sidebar.profile')}
              onPress={() => go(() => router.push('/profile'))}
              style={styles.profile}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                <AppText weight={600} tone="primary">
                  {user?.initial ?? ''}
                </AppText>
              </View>
              <View style={styles.grow}>
                <AppText variant="small" weight={600} numberOfLines={1}>
                  {user?.name ?? ''}
                </AppText>
                {user?.professionalTitle ? (
                  <AppText variant="caption" tone="subtle" numberOfLines={1}>
                    {user.professionalTitle}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
            <IconButton label={mobile('sidebar.plans')} onPress={() => go(() => router.push('/billing'))}>
              <CreditCard size={20} color={colors.textMuted} />
            </IconButton>
            <IconButton
              label={t('signOut')}
              onPress={() => {
                close();
                void signOut();
              }}
            >
              <SignOut
                size={20}
                color={colors.textMuted}
                style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}
              />
            </IconButton>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mobile('close')}
          style={[styles.scrim, { backgroundColor: colors.scrim }]}
          onPress={close}
        />
      </View>

      <Sheet open={menuFor !== null} onClose={() => setMenuFor(null)} title={menuFor?.title ?? ''}>
        <Pressable
          accessibilityRole="button"
          style={styles.menuItem}
          onPress={() => {
            if (!menuFor) return;
            setTitle(menuFor.title);
            setPending({ kind: 'rename', ...menuFor });
            setMenuFor(null);
          }}
        >
          <PencilSimple size={20} color={colors.textMuted} />
          <AppText weight={500}>{item('rename')}</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.menuItem}
          onPress={() => {
            if (!menuFor) return;
            setPending({ kind: 'delete', ...menuFor });
            setMenuFor(null);
          }}
        >
          <Trash size={20} color={colors.error} />
          <AppText weight={500} tone="error">
            {item('delete')}
          </AppText>
        </Pressable>
      </Sheet>

      <Sheet
        open={pending?.kind === 'rename'}
        onClose={finish}
        title={item('renameTitle')}
        placement="center"
      >
        <TextField
          label={item('renameLabel')}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          autoFocus
          autoCapitalize="sentences"
        />
        {problem ? (
          <AppText variant="small" tone="error">
            {item('failed')}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <Button variant="ghost" label={item('cancel')} onPress={finish} />
          <Button
            label={busy ? item('saving') : item('save')}
            loading={busy}
            disabled={title.trim().length === 0}
            onPress={async () => {
              if (pending?.kind !== 'rename') return;
              setBusy(true);
              setProblem(false);
              const ok = await rename(pending.id, title.trim());
              if (ok) finish();
              else {
                setBusy(false);
                setProblem(true);
              }
            }}
          />
        </View>
      </Sheet>

      <Sheet
        open={pending?.kind === 'delete'}
        onClose={finish}
        title={item('deleteTitle')}
        placement="center"
      >
        <AppText variant="small" weight={600}>
          {pending?.title}
        </AppText>
        <AppText variant="small" tone="muted">
          {item('deleteBody')}
        </AppText>
        {problem ? (
          <AppText variant="small" tone="error">
            {item('failed')}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <Button variant="ghost" label={item('cancel')} onPress={finish} />
          <Button
            variant="danger"
            label={busy ? item('deleting') : item('confirmDelete')}
            loading={busy}
            onPress={async () => {
              if (pending?.kind !== 'delete') return;
              const { id } = pending;
              setBusy(true);
              setProblem(false);
              const ok = await remove(id);
              if (ok) {
                finish();
                close();
                if (id === activeId) onNew();
              } else {
                setBusy(false);
                setProblem(true);
              }
            }}
          />
        </View>
      </Sheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Row direction follows the language, so the panel is on the start edge in both.
  root: { flex: 1, flexDirection: 'row' },
  panel: {
    width: '84%',
    maxWidth: 360,
    paddingHorizontal: 12,
    gap: 12,
    borderEndWidth: StyleSheet.hairlineWidth,
  },
  scrim: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 6 },
  history: { flex: 1 },
  historyContent: { gap: 16, paddingTop: 4 },
  group: { gap: 2 },
  pad: { paddingHorizontal: 12 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  conversation: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44,
  },
  conversationMain: { flex: 1, minHeight: 44, justifyContent: 'center', paddingStart: 12 },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  profile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: size.control },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
});
