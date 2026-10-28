import * as Clipboard from 'expo-clipboard';
import { Check, Copy, File as FileIcon, ListChecks } from 'phosphor-react-native';
import { memo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import type { MessageDto } from '@/application/dto/dto';
import { Banner } from '@/components/ui/banner';
import { AppText } from '@/components/ui/text';
import { withoutReferenceBlocks, withoutSourcesBlock } from '@/domain/services/answer-text';
import { pastedTextNumber } from '@/domain/entities/attachment';
import { useT } from '@/i18n/use-t';
import { formatNumber, formatTime } from '@/presentation/lib/format';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { AnswerMarkdown } from './answer-markdown';
import { CitationList } from './citation-list';

const ICON = require('../../../assets/brand/app-icon-sm.png');

/** The person's own question, with the files that went with it. */
export const UserMessage = memo(function UserMessage({ message }: { message: MessageDto }) {
  const t = useT('chat');
  const files = useT('chat.composer.attachments');
  const { colors, locale } = useTheme();

  return (
    <View style={styles.userWrap}>
      <View style={[styles.userBubble, { backgroundColor: colors.userBubble, borderColor: colors.border }]}>
        <AppText accessibilityLabel={`${t('message.yourMessage')}: ${message.content}`} selectable>
          {message.content}
        </AppText>
        {message.attachments.length > 0 ? (
          <View style={styles.files}>
            {message.attachments.map((file) => {
              const pasted = pastedTextNumber(file.name);
              return (
                <View key={file.id} style={[styles.file, { borderColor: colors.borderStrong }]}>
                  <FileIcon size={14} color={colors.textMuted} />
                  <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.fileName}>
                    {pasted === null ? file.name : files('pasted', { n: pasted })}
                  </AppText>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
      <AppText variant="caption" tone="subtle" style={styles.time}>
        {formatTime(message.createdAt, locale)}
      </AppText>
    </View>
  );
});

function Action({
  label,
  onPress,
  done,
  children,
}: {
  label: string;
  onPress: () => void;
  done: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: pressed ? colors.surfaceHover : 'transparent' },
      ]}
    >
      {done ? <Check size={18} color={colors.success} /> : children}
    </Pressable>
  );
}

/** An answer: Markdown text, its sources, what it cost, and what went wrong if something did. */
export const AssistantMessage = memo(function AssistantMessage({ message }: { message: MessageDto }) {
  const t = useT('chat');
  const { colors, locale } = useTheme();
  const [copied, setCopied] = useState<'answer' | 'references' | null>(null);
  const [details, setDetails] = useState(false);

  const streaming = message.status === 'streaming';
  const text = withoutSourcesBlock(withoutReferenceBlocks(message.content), message.citations.length > 0);
  const hasText = text.trim().length > 0;
  const errorKey =
    message.errorCode && t.has(`errors.${message.errorCode}`) ? message.errorCode : 'unknown';

  const copy = async (kind: 'answer' | 'references') => {
    const references = message.citations
      .map((c) => `- ${c.lawName}, ${t('citation.short', { article: c.article })}`)
      .join('\n');
    const value =
      kind === 'references' && references ? `${text}\n\n${t('message.sources')}:\n${references}` : text;
    await Clipboard.setStringAsync(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <View
      accessible={false}
      accessibilityLabel={streaming ? t('message.answerBusy') : t('message.answer')}
      style={styles.answer}
    >
      <View style={styles.head}>
        <Image source={ICON} style={styles.avatar} />
        <AppText variant="small" weight={600}>
          {t('message.assistantName')}
        </AppText>
        {streaming ? (
          <View style={styles.typing} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.primary} />
            <AppText variant="caption" tone="subtle">
              {t('message.typing')}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" tone="subtle">
            {formatTime(message.createdAt, locale)}
          </AppText>
        )}
      </View>

      {hasText ? <AnswerMarkdown>{text}</AnswerMarkdown> : null}

      {message.warning ? (
        <Banner tone="warning">
          {`${t('message.warning')}: ${message.warning}`}
        </Banner>
      ) : null}

      {message.status === 'error' ? (
        <Banner tone="error">{`${t(`errors.${errorKey}`)} ${t('message.retryHint')}`}</Banner>
      ) : null}

      {message.status === 'stopped' ? (
        <AppText variant="small" tone="subtle">
          {t('message.stopped')}
        </AppText>
      ) : null}

      {message.citations.length > 0 ? <CitationList citations={message.citations} /> : null}

      {!streaming && hasText ? (
        <View accessibilityRole="toolbar" accessibilityLabel={t('message.actions')} style={styles.toolbar}>
          <Action
            label={copied === 'answer' ? t('message.copied') : t('message.copy')}
            done={copied === 'answer'}
            onPress={() => void copy('answer')}
          >
            <Copy size={18} color={colors.textMuted} />
          </Action>
          {message.citations.length > 0 ? (
            <Action
              label={copied === 'references' ? t('message.copied') : t('message.copyWithReferences')}
              done={copied === 'references'}
              onPress={() => void copy('references')}
            >
              <ListChecks size={18} color={colors.textMuted} />
            </Action>
          ) : null}
        </View>
      ) : null}

      {!streaming && message.usage ? (
        <View style={styles.usage}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: details }}
            onPress={() => setDetails((value) => !value)}
            hitSlop={8}
          >
            <AppText variant="caption" tone="subtle">
              {t('usage.answer', { count: formatNumber(message.usage.total) })}
            </AppText>
          </Pressable>
          {details ? (
            <View style={styles.usageRows}>
              {[
                [t('usage.prompt'), message.usage.prompt],
                [t('usage.completion'), message.usage.completion],
                [t('usage.total'), message.usage.total],
              ].map(([label, value]) => (
                <View key={String(label)} style={styles.usageRow}>
                  <AppText variant="caption" tone="subtle">
                    {label}
                  </AppText>
                  <AppText variant="caption" tone="subtle" style={styles.number}>
                    {formatNumber(Number(value))}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  userWrap: { alignItems: 'flex-end', gap: 2, paddingStart: 40 },
  userBubble: {
    borderWidth: 1,
    borderRadius: radius.xl,
    borderEndEndRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    maxWidth: '100%',
  },
  files: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 200,
  },
  fileName: { flexShrink: 1 },
  time: { paddingHorizontal: 4 },
  answer: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 24, height: 24, borderRadius: 6 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolbar: { flexDirection: 'row', gap: 4, marginStart: -8 },
  action: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  usage: { gap: 6 },
  usageRows: { gap: 2, alignSelf: 'flex-start', minWidth: 220 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 24 },
  number: { fontVariant: ['tabular-nums'] },
});
