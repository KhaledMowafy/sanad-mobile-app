import * as Clipboard from 'expo-clipboard';
import { Copy } from 'phosphor-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { CitationDto } from '@/application/dto/dto';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Tag } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { useT } from '@/i18n/use-t';
import { useArticle } from '@/presentation/chat/use-article';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

function CitationBody({ citation }: { citation: CitationDto }) {
  const t = useT('chat.citation');
  const mobile = useT('mobile');
  const { colors } = useTheme();
  const { state, retry } = useArticle(citation);
  const [copied, setCopied] = useState(false);

  const hasLawNumber = citation.lawNumber !== null && citation.lawYear !== null;
  const law = hasLawNumber
    ? t('lawLineFull', { law: citation.lawName, number: citation.lawNumber ?? 0, year: citation.lawYear ?? 0 })
    : citation.lawName;
  const status =
    citation.status === 'in_force' ? t('inForce') : citation.status === 'amended' ? t('amended') : t('repealed');

  const copy = async () => {
    if (state.status !== 'ready') return;
    await Clipboard.setStringAsync(state.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={styles.body}>
      <AppText variant="caption" tone="subtle">
        {t('cardLabel', { article: t('articleTitle', { article: citation.article }) })}
      </AppText>
      <AppText variant="h3">{t('articleTitle', { article: citation.article })}</AppText>
      <AppText tone="muted">{law}</AppText>

      <View style={[styles.text, { backgroundColor: colors.surfaceSunken }]}>
        {state.status === 'ready' ? (
          <ScrollView style={styles.scroll} nestedScrollEnabled>
            <AppText selectable>{state.text}</AppText>
          </ScrollView>
        ) : state.status === 'loading' ? (
          <View style={styles.loading} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary} />
            <AppText tone="subtle">{t('loading')}</AppText>
          </View>
        ) : (
          <View style={styles.loading} accessibilityRole="alert">
            <AppText tone="error">{t('unavailable')}</AppText>
            <Button variant="secondary" label={t('retry')} onPress={retry} />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Tag
          label={status}
          tone={citation.status === 'in_force' ? 'success' : 'muted'}
          background={citation.status === 'in_force' ? colors.successBg : colors.surfaceSunken}
        />
        {citation.bookLabel ? <Tag label={citation.bookLabel} /> : null}
        <View style={styles.spacer} />
        <Button
          variant="ghost"
          label={copied ? mobile('article.copied') : mobile('article.copy')}
          disabled={state.status !== 'ready'}
          icon={<Copy size={16} color={colors.primaryText} />}
          onPress={() => void copy()}
        />
      </View>
    </View>
  );
}

/**
 * The sources behind an answer. A chip opens the article's text in a sheet from the bottom of the
 * screen; one article is open at a time.
 */
export function CitationList({ citations }: { citations: CitationDto[] }) {
  const t = useT('chat');
  const { colors } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const active = citations.find((c) => c.id === openId) ?? null;

  return (
    <View accessibilityLabel={t('message.sources')} style={styles.list}>
      <AppText variant="caption" weight={600} tone="subtle">
        {t('message.sourcesCount', { count: citations.length })}
      </AppText>
      <View style={styles.chips}>
        {citations.map((citation) => (
          <Pressable
            key={citation.id}
            accessibilityRole="button"
            accessibilityLabel={t('citation.chip', {
              article: t('citation.articleTitle', { article: citation.article }),
              law: citation.lawName,
            })}
            onPress={() => setOpenId(citation.id)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                borderColor: colors.borderStrong,
              },
            ]}
          >
            <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.chipLaw}>
              {citation.lawName}
            </AppText>
            <AppText variant="caption" weight={600} tone="primary">
              {t('citation.short', { article: citation.article })}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Sheet open={active !== null} onClose={() => setOpenId(null)} title={t('message.sources')}>
        {active ? <CitationBody citation={active} /> : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    minHeight: 36,
    maxWidth: '100%',
  },
  chipLaw: { flexShrink: 1 },
  body: { gap: 8, paddingBottom: 8 },
  text: { borderRadius: radius.md, padding: 12, minHeight: 80 },
  scroll: { maxHeight: 300 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  spacer: { flex: 1 },
});
