import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/text';
import { useT } from '@/i18n/use-t';
import { radius } from '@/theme/tokens';

const ICON = require('../../../assets/brand/app-icon-sm.png');

/**
 * A new conversation: the greeting and the question box, nothing else. The documents the cards
 * used to offer are one tap away in the composer (memo, review, and the templates pill).
 */
export function EmptyState({
  name,
  evening,
  children,
}: {
  name: string;
  evening: boolean;
  children: ReactNode;
}) {
  const t = useT('chat.empty');

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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', gap: 24, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32 },
  greeting: { gap: 8 },
  icon: { width: 48, height: 48, borderRadius: radius.lg, marginBottom: 4 },
});
