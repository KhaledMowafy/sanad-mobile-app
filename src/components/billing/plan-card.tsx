import { Check } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { estimateRequests, type Plan } from '@/domain/entities/billing';
import { useT } from '@/i18n/use-t';
import { formatEgp, formatNumber } from '@/presentation/lib/format';
import { useTheme } from '@/theme/theme';

/** One plan: its price, what it holds, and a slot for the button. The same card on the welcome page and in the app. */
export function PlanCard({
  plan,
  highlighted = false,
  children,
}: {
  plan: Plan;
  /** The plan the account is on. */
  highlighted?: boolean;
  children?: ReactNode;
}) {
  const t = useT('billing');
  const { colors, locale } = useTheme();
  const estimate = estimateRequests(plan.tokens);

  const lines = [
    t('tokens', { count: formatNumber(plan.tokens) }),
    t('pages', { count: formatNumber(plan.pages) }),
    t('approxQuestions', { count: formatNumber(estimate.questions) }),
    t('approxCases', { count: formatNumber(estimate.cases) }),
    t('approxMemos', { count: formatNumber(estimate.memos) }),
  ];

  return (
    <Card highlighted={highlighted} accessibilityLabel={plan.name} style={styles.card}>
      <View style={styles.head}>
        <AppText variant="h3">{plan.name}</AppText>
        <AppText variant="h2" style={styles.price}>
          {formatEgp(plan.pricePiastres, locale)}
        </AppText>
        <AppText variant="small" tone="muted">
          {t('monthly')}
        </AppText>
      </View>

      <View style={styles.lines}>
        {lines.map((line) => (
          <View key={line} style={styles.line}>
            <Check size={18} color={colors.success} weight="bold" style={styles.check} />
            <AppText style={styles.lineText}>{line}</AppText>
          </View>
        ))}
      </View>

      {children ? <View style={styles.actions}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  head: { gap: 2 },
  price: { fontVariant: ['tabular-nums'] },
  lines: { gap: 8 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  check: { marginTop: 4 },
  lineText: { flex: 1 },
  actions: { gap: 8, paddingTop: 4 },
});
