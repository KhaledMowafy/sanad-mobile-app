import { ArrowRight } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/text';
import { useT } from '@/i18n/use-t';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

const ICON = require('../../../assets/brand/app-icon-sm.png');

interface Starter {
  topic: string;
  q: string;
}

/** Greeting and starter questions. The composer sits between them, as designed. */
export function EmptyState({
  name,
  evening,
  onAsk,
  cards,
  children,
}: {
  name: string;
  evening: boolean;
  onAsk: (question: string) => void;
  /** The use case cards, shown right under the composer. */
  cards?: ReactNode;
  children: ReactNode;
}) {
  const t = useT('chat.empty');
  const { colors, rtl } = useTheme();
  const starters = t.raw<Starter[]>('starters');

  return (
    <View style={styles.wrap}>
      <View style={styles.greeting}>
        <Image source={ICON} style={styles.icon} />
        <AppText variant="h2">{evening ? t('evening', { name }) : t('morning', { name })}</AppText>
        <AppText variant="lead" tone="muted">
          {t('body')}
        </AppText>
      </View>

      {children}

      {cards ? (
        <View style={styles.section}>
          <AppText variant="small" weight={600} tone="muted">
            {t('casesLabel')}
          </AppText>
          {cards}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="small" weight={600} tone="muted">
          {t('startersLabel')}
        </AppText>
        {starters.map((starter) => (
          <Pressable
            key={starter.q}
            accessibilityRole="button"
            accessibilityLabel={starter.q}
            onPress={() => onAsk(starter.q)}
            style={({ pressed }) => [
              styles.starter,
              {
                backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.starterText}>
              <AppText variant="caption" weight={600} tone="primary">
                {starter.topic}
              </AppText>
              <AppText weight={500}>{starter.q}</AppText>
            </View>
            <ArrowRight
              size={16}
              color={colors.textSubtle}
              style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32 },
  greeting: { gap: 8 },
  icon: { width: 48, height: 48, borderRadius: radius.lg, marginBottom: 4 },
  section: { gap: 12 },
  starter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
  },
  starterText: { flex: 1, gap: 4 },
});
