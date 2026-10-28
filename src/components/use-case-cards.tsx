import {
  ChatCircleText,
  FileArrowUp,
  FileMagnifyingGlass,
  FileText,
  PencilSimpleLine,
  type Icon,
} from 'phosphor-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/text';
import { useT } from '@/i18n/use-t';
import { useTheme } from '@/theme/theme';
import { radius, type Colors } from '@/theme/tokens';

export type UseCaseKey = 'question' | 'memo' | 'draft' | 'review' | 'notice';

const CASES: { key: UseCaseKey; Icon: Icon; tone: (c: Colors) => { bg: string; fg: string } }[] = [
  { key: 'question', Icon: ChatCircleText, tone: (c) => ({ bg: c.infoBg, fg: c.info }) },
  { key: 'memo', Icon: FileText, tone: (c) => ({ bg: c.errorBg, fg: c.error }) },
  { key: 'draft', Icon: PencilSimpleLine, tone: (c) => ({ bg: c.primarySoft, fg: c.primaryText }) },
  { key: 'review', Icon: FileMagnifyingGlass, tone: (c) => ({ bg: c.successBg, fg: c.success }) },
  { key: 'notice', Icon: FileArrowUp, tone: (c) => ({ bg: c.accentSoft, fg: c.accentText }) },
];

/**
 * The five things the product does, as a row of cards that scrolls sideways. The landing page and
 * the chat show the same cards; what a card does is up to the screen that shows it.
 */
export function UseCaseCards({
  onPick,
  showHints = false,
}: {
  onPick: (key: UseCaseKey) => void;
  showHints?: boolean;
}) {
  const t = useT('useCases');
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {CASES.map(({ key, Icon, tone }) => {
        const { bg, fg } = tone(colors);
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={t(`${key}.label`)}
            onPress={() => onPick(key)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: bg }]}>
              <Icon size={24} color={fg} />
            </View>
            <AppText variant="small" weight={500} align="center" numberOfLines={3}>
              {t(`${key}.label`)}
            </AppText>
            {showHints ? (
              <AppText variant="caption" tone="muted" align="center">
                {t(`${key}.hint`)}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingVertical: 2, paddingHorizontal: 1 },
  card: {
    width: 112,
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 14,
  },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
