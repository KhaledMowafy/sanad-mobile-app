import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowUp,
  Camera,
  FileText,
  Files,
  Image as ImageIcon,
  Info,
  Paperclip,
  Stop,
  X,
} from 'phosphor-react-native';
import { useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { ChatAttachmentDto, UsageSnapshotDto } from '@/application/dto/dto';
import { Sheet } from '@/components/ui/sheet';
import { AppText } from '@/components/ui/text';
import { pastedTextName, pastedTextNumber } from '@/domain/entities/attachment';
import { blockingLimit } from '@/domain/entities/usage';
import { useT, type Translator } from '@/i18n/use-t';
import type { PickedFile } from '@/presentation/chat/attachment-client';
import { ASK_MODE, type ComposerMode } from '@/presentation/chat/composer-mode';
import { useLimits } from '@/stores/limits-store';
import { useTheme } from '@/theme/theme';
import { radius, size } from '@/theme/tokens';
import { UsageStrip } from './usage-strip';

/** What the backend accepts as the typed text of a memo or a template draft. */
const PROMPT_MAX_CHARS = 8000;

function defaultRequest(mode: ComposerMode, t: Translator): string {
  if (mode.kind === 'review') return t('reviewDefault');
  if (mode.kind === 'ask') return t('attachDefault');
  return '';
}

function placeholderFor(mode: ComposerMode, t: Translator): string {
  if (mode.kind === 'memo') return t('memoPlaceholder');
  if (mode.kind === 'review') return t('reviewPlaceholder');
  if (mode.kind === 'template') return t('templatePlaceholder');
  return t('placeholder');
}

/**
 * The text that was inserted: what `next` has that `previous` did not, found from the common
 * start and end of the two. A paste is the only way a lot of text arrives at once.
 */
function insertedText(previous: string, next: string): { text: string; rest: string } {
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start += 1;
  let end = 0;
  while (
    end < previous.length - start &&
    end < next.length - start &&
    previous[previous.length - 1 - end] === next[next.length - 1 - end]
  ) {
    end += 1;
  }
  return { text: next.slice(start, next.length - end), rest: next.slice(0, start) + next.slice(next.length - end) };
}

function Pill({
  label,
  active,
  onPress,
  children,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: active ? colors.primarySoft : 'transparent',
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      {children}
      <AppText variant="caption" weight={600} tone={active ? 'primary' : 'muted'}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Send asks in the chosen mode: a question, a defence memo, a contract review, or a catalogue
 * document. While an answer streams the send button becomes Stop. Text pasted past the box's
 * limit becomes a text file, as on the website.
 */
export function Composer({
  onSend,
  onStop,
  streaming,
  attachments = [],
  uploading = false,
  uploadProgress = null,
  attachmentError = null,
  usage = null,
  draftBusy = false,
  mode = ASK_MODE,
  onModeChange,
  onOpenTemplates,
  onAttach,
  onDetach,
  onNewConversation,
}: {
  onSend: (text: string, options: { mode: ComposerMode }) => void;
  onStop: () => void;
  streaming: boolean;
  attachments?: readonly ChatAttachmentDto[];
  uploading?: boolean;
  uploadProgress?: { done: number; total: number } | null;
  /** A stable code for whatever went wrong with a file or a memo request. */
  attachmentError?: string | null;
  usage?: UsageSnapshotDto | null;
  draftBusy?: boolean;
  mode?: ComposerMode;
  onModeChange?: (mode: ComposerMode) => void;
  onOpenTemplates?: () => void;
  onAttach?: (files: PickedFile[]) => void;
  onDetach?: (id: string) => void;
  onNewConversation: () => void;
}) {
  const t = useT('chat.composer');
  const mobile = useT('mobile');
  const { colors, font } = useTheme();
  const limits = useLimits((s) => s.limits);
  const [value, setValue] = useState('');
  const [menu, setMenu] = useState(false);
  const [denied, setDenied] = useState(false);
  const pastes = useRef(0);

  const empty = value.trim().length === 0;
  const reading = uploading || attachments.some((a) => a.state === 'queued' || a.state === 'reading');
  // A memo and a document are built in the background, so only the month can hold them back.
  const background = mode.kind === 'memo' || mode.kind === 'template';
  const limited = blockingLimit(usage, { memo: background }) !== null;
  const nothingToSend = empty && attachments.length === 0;
  const cannotSend = nothingToSend || reading || limited || draftBusy;
  const textual = mode.kind === 'ask' || mode.kind === 'review';
  const pasteLimit = textual ? limits.questionMaxChars : PROMPT_MAX_CHARS;

  const submit = () => {
    if (cannotSend || streaming) return;
    onSend(empty ? defaultRequest(mode, t) : value, { mode });
    setValue('');
  };

  const change = (next: string) => {
    // A jump of more than a few characters past the limit is a paste: keep it as a file instead.
    if (onAttach && next.length > pasteLimit && next.length - value.length > 1) {
      const { text, rest } = insertedText(value, next);
      if (text.length > 0) {
        const used = attachments.map((a) => pastedTextNumber(a.name) ?? 0);
        pastes.current = Math.max(pastes.current, ...used) + 1;
        try {
          const file = new File(Paths.cache, pastedTextName(pastes.current));
          file.create({ overwrite: true });
          file.write(text);
          onAttach([{ uri: file.uri, name: file.name, size: file.size, mimeType: 'text/plain' }]);
          setValue(rest);
          return;
        } catch {
          // Fall through and keep the text in the box.
        }
      }
    }
    setValue(next.slice(0, textual ? limits.questionMaxChars : undefined));
  };

  const pickDocuments = async () => {
    setMenu(false);
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: '*/*',
    });
    if (result.canceled) return;
    onAttach?.(
      result.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        size: a.size ?? 0,
        mimeType: a.mimeType,
      })),
    );
  };

  const toPicked = (assets: ImagePicker.ImagePickerAsset[]): PickedFile[] =>
    assets.map((a, index) => {
      const extension = (a.fileName?.split('.').pop() ?? a.uri.split('.').pop() ?? 'jpg').toLowerCase();
      return {
        uri: a.uri,
        name: a.fileName ?? `photo-${Date.now()}-${index}.${extension}`,
        size: a.fileSize ?? 0,
        mimeType: a.mimeType ?? `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      };
    });

  const pickPhotos = async () => {
    setMenu(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setDenied(true);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (!result.canceled) onAttach?.(toPicked(result.assets));
  };

  const takePhoto = async () => {
    setMenu(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setDenied(true);
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled) onAttach?.(toPicked(result.assets));
  };

  const errorText = denied
    ? mobile('attach.permission')
    : attachmentError
      ? t.has(`attachments.errors.${attachmentError}`)
        ? t(`attachments.errors.${attachmentError}`)
        : t('attachments.errors.generic')
      : null;

  const limitsText = t('attachments.limits', {
    count: limits.attachments.perConversation,
    size: Math.round(limits.attachments.maxBytes / (1024 * 1024)),
    pages: limits.attachments.pagesRead,
  });

  const menuItems = [
    { key: 'files', label: mobile('attach.files'), Icon: Files, run: pickDocuments },
    { key: 'photos', label: mobile('attach.photos'), Icon: ImageIcon, run: pickPhotos },
    { key: 'camera', label: mobile('attach.camera'), Icon: Camera, run: takePhoto },
  ];

  return (
    <View style={styles.wrap}>
      <UsageStrip usage={usage} defenceMemo={background} onNewConversation={onNewConversation} />

      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
        {mode.kind === 'template' ? (
          <View style={[styles.chosen, { backgroundColor: colors.primarySoft }]}>
            <FileText size={16} color={colors.primaryText} />
            <AppText variant="small" weight={600} tone="primary" numberOfLines={1} style={styles.grow}>
              {t('modeTemplate', { name: mode.template.name })}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('clearMode')}
              onPress={() => onModeChange?.(ASK_MODE)}
              hitSlop={10}
            >
              <X size={14} color={colors.primaryText} />
            </Pressable>
          </View>
        ) : null}

        {attachments.length > 0 || uploading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {attachments.map((a) => {
              const pasted = pastedTextNumber(a.name);
              return (
                <View key={a.id} style={[styles.chip, { borderColor: colors.border }]}>
                  <AppText variant="caption" numberOfLines={1} style={styles.chipName}>
                    {pasted === null ? a.name : t('attachments.pasted', { n: pasted })}
                  </AppText>
                  <AppText variant="caption" tone={a.state === 'failed' ? 'error' : 'subtle'}>
                    {a.state === 'ready'
                      ? t('attachments.ready')
                      : a.state === 'failed'
                        ? t('attachments.failed')
                        : t('attachments.reading')}
                  </AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('attachments.remove', { name: a.name })}
                    onPress={() => onDetach?.(a.id)}
                    hitSlop={10}
                  >
                    <X size={14} color={colors.textMuted} />
                  </Pressable>
                </View>
              );
            })}
            {uploading ? (
              <AppText variant="caption" tone="subtle" accessibilityLiveRegion="polite" style={styles.uploading}>
                {uploadProgress && uploadProgress.total > 1
                  ? t('attachments.uploadingProgress', {
                      done: uploadProgress.done + 1,
                      total: uploadProgress.total,
                    })
                  : t('attachments.uploading')}
              </AppText>
            ) : null}
          </ScrollView>
        ) : null}

        <TextInput
          accessibilityLabel={t('label')}
          multiline
          value={value}
          onChangeText={change}
          placeholder={placeholderFor(mode, t)}
          placeholderTextColor={colors.textSubtle}
          textAlignVertical="top"
          style={[styles.input, { color: colors.text, fontFamily: font(400) }]}
        />

        <View style={styles.bar}>
          {onAttach ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('attachments.add')}
              onPress={() => {
                setDenied(false);
                setMenu(true);
              }}
              style={styles.iconBtn}
            >
              <Paperclip size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pills}
            style={styles.grow}
            keyboardShouldPersistTaps="handled"
          >
            <Pill
              label={mobile('mode.memo')}
              active={mode.kind === 'memo'}
              onPress={() => onModeChange?.(mode.kind === 'memo' ? ASK_MODE : { kind: 'memo' })}
            />
            <Pill
              label={mobile('mode.review')}
              active={mode.kind === 'review'}
              onPress={() => onModeChange?.(mode.kind === 'review' ? ASK_MODE : { kind: 'review' })}
            />
            {onOpenTemplates ? (
              <Pill label={t('templates')} active={mode.kind === 'template'} onPress={onOpenTemplates}>
                <FileText size={14} color={mode.kind === 'template' ? colors.primaryText : colors.textMuted} />
              </Pill>
            ) : null}
          </ScrollView>

          {streaming ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('stop')}
              onPress={onStop}
              style={[styles.send, { backgroundColor: colors.text }]}
            >
              <Stop size={18} weight="fill" color={colors.bg} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mode.kind === 'memo' ? t('sendMemo') : mode.kind === 'template' ? t('sendTemplate') : t('send')}
              accessibilityState={{ disabled: cannotSend }}
              disabled={cannotSend}
              onPress={submit}
              style={[styles.send, { backgroundColor: cannotSend ? colors.surfaceSunken : colors.primary }]}
            >
              <ArrowUp size={20} weight="bold" color={cannotSend ? colors.textDisabled : colors.onPrimary} />
            </Pressable>
          )}
        </View>
      </View>

      {errorText ? (
        <AppText variant="small" tone="error" accessibilityRole="alert">
          {errorText}
        </AppText>
      ) : null}
      {denied ? (
        <Pressable accessibilityRole="link" onPress={() => void Linking.openSettings()}>
          <AppText variant="small" tone="primary" weight={600}>
            {mobile('attach.openSettings')}
          </AppText>
        </Pressable>
      ) : null}

      <View style={styles.notes}>
        {onAttach ? (
          <AppText variant="caption" tone="subtle" align="center">
            {limitsText}
          </AppText>
        ) : null}
        <View style={styles.disclaimer}>
          <Info size={14} color={colors.textSubtle} />
          <AppText variant="caption" tone="subtle" style={styles.grow}>
            {t('disclaimer')}
          </AppText>
        </View>
      </View>

      <Sheet open={menu} onClose={() => setMenu(false)} title={mobile('attach.title')}>
        {menuItems.map(({ key, label, Icon, run }) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => void run()}
            style={({ pressed }) => [
              styles.menuItem,
              { backgroundColor: pressed ? colors.surfaceHover : 'transparent' },
            ]}
          >
            <Icon size={22} color={colors.primaryText} />
            <AppText weight={500}>{label}</AppText>
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  grow: { flex: 1 },
  box: { borderWidth: 1, borderRadius: radius.xl, padding: 8, gap: 6 },
  input: { minHeight: 48, maxHeight: 180, fontSize: 16, lineHeight: 24, paddingHorizontal: 8, paddingTop: 6 },
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chips: { gap: 8, paddingHorizontal: 4, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 260,
  },
  chipName: { flexShrink: 1 },
  uploading: { paddingHorizontal: 8 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: size.control, height: size.control, alignItems: 'center', justifyContent: 'center' },
  pills: { gap: 6, alignItems: 'center', paddingHorizontal: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    minHeight: 32,
  },
  send: {
    width: size.control,
    height: size.control,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notes: { gap: 4 },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
});
