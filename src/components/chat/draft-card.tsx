import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { DownloadSimple, FileText } from 'phosphor-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { DraftDto } from '@/application/dto/dto';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { useT } from '@/i18n/use-t';
import { getContainer } from '@/infrastructure/di/container';
import { formatTime } from '@/presentation/lib/format';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

/** Parts of the document the person must fill in, marked "[يُملأ: ...]" by the backend. */
const PLACEHOLDER = /(\[\s*يُملأ[^\]]*\])/u;

function DocumentText({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.text, { backgroundColor: colors.surfaceSunken }]}>
      <AppText variant="small" selectable>
        {text.split(PLACEHOLDER).map((part, index) =>
          index % 2 === 1 ? (
            <AppText
              key={index}
              variant="small"
              weight={600}
              style={{ backgroundColor: colors.accentSoft, color: colors.accentText }}
            >
              {part}
            </AppText>
          ) : (
            part
          ),
        )}
      </AppText>
    </View>
  );
}

/**
 * A defence memo or a catalogue document. It is built in the background, not streamed, so the card
 * shows what stage it is at, then offers the Word file through the share sheet and a preview.
 */
export function DraftCard({ draft }: { draft: DraftDto }) {
  const t = useT('chat.drafts');
  const mobile = useT('mobile');
  const { colors, locale } = useTheme();
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const working = draft.status === 'queued' || draft.status === 'reading' || draft.status === 'generating';
  const hasPlaceholders = draft.output !== null && PLACEHOLDER.test(draft.output);
  const tone = draft.status === 'done' ? 'success' : draft.status === 'failed' ? 'error' : 'muted';
  const statusBg =
    draft.status === 'done' ? colors.successBg : draft.status === 'failed' ? colors.errorBg : colors.surfaceSunken;

  /** Saves the Word file to the cache and opens the share sheet, so it can go to Files, Drive or a mail app. */
  const download = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const result = await getContainer().useCases.downloadDraft.execute(draft.id);
      if (!result.ok) throw new Error(result.error.kind);
      const file = new File(Paths.cache, result.value.filename);
      file.create({ overwrite: true });
      file.write(result.value.bytes);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: result.value.contentType,
          dialogTitle: mobile('draft.shareTitle'),
          UTI: 'org.openxmlformats.wordprocessingml.document',
        });
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card accessibilityLabel={draft.templateName ?? t('title')} style={styles.card}>
      <View style={styles.head}>
        <FileText size={20} color={colors.primaryText} />
        <AppText variant="h4" style={styles.title}>
          {draft.templateName ?? t('title')}
        </AppText>
        <AppText variant="caption" tone="subtle">
          {formatTime(draft.createdAt, locale)}
        </AppText>
      </View>

      <View
        accessibilityRole="text"
        accessibilityLabel={`${t('statusLabel')}: ${t(draft.status)}`}
        accessibilityLiveRegion="polite"
        style={[styles.status, { backgroundColor: statusBg }]}
      >
        {working ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        <AppText variant="caption" weight={600} tone={tone}>
          {t(draft.status)}
        </AppText>
      </View>

      {draft.prompt ? (
        <AppText variant="small" tone="muted">
          <AppText variant="small" weight={600}>
            {t('asked')}:{' '}
          </AppText>
          {draft.prompt}
        </AppText>
      ) : null}

      {working ? (
        <AppText variant="small" tone="subtle">
          {t('wait')}
        </AppText>
      ) : null}

      {draft.status === 'failed' && draft.error ? (
        <Banner tone="error">{`${t('error')}: ${draft.error}`}</Banner>
      ) : null}
      {draft.warning ? <Banner tone="error">{`${t('warning')}: ${draft.warning}`}</Banner> : null}

      {draft.status === 'done' ? (
        <View style={styles.actions}>
          <View style={styles.buttons}>
            <Button
              label={t('download')}
              loading={busy}
              icon={<DownloadSimple size={18} color={colors.onPrimary} />}
              onPress={() => void download()}
            />
            {draft.output ? (
              <Button
                variant="secondary"
                label={showText ? t('hide') : t('show')}
                onPress={() => setShowText((value) => !value)}
              />
            ) : null}
          </View>
          {failed ? <Banner tone="error">{t('downloadFailed')}</Banner> : null}
          {showText && draft.output ? (
            <>
              <DocumentText text={draft.output} />
              {hasPlaceholders ? (
                <AppText variant="caption" tone="subtle">
                  {t('placeholderHint')}
                </AppText>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  status: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  actions: { gap: 10 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  text: { borderRadius: radius.md, padding: 12 },
});
