import { useRouter } from 'expo-router';
import { WarningCircle } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import type { UsageSnapshotDto } from '@/application/dto/dto';
import { Meter } from '@/components/ui/meter';
import { AppText } from '@/components/ui/text';
import { blockingLimit, type UserPeriodUsage } from '@/domain/entities/usage';
import { useT } from '@/i18n/use-t';
import { formatDate, formatNumber } from '@/presentation/lib/format';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

/**
 * Where the conversation and the month stand against their limits, and what to do when one is
 * close or spent. Draws nothing when the account has no limits to show.
 */
export function UsageStrip({
  usage,
  defenceMemo,
  onNewConversation,
}: {
  usage: UsageSnapshotDto | null;
  /** A memo is only held back by the month, so the banner follows what Send would do. */
  defenceMemo: boolean;
  onNewConversation: () => void;
}) {
  const t = useT('chat.usage');
  const { colors, locale } = useTheme();
  const router = useRouter();
  if (!usage) return null;

  const conversation = usage.conversation;
  const user = usage.user;
  const hasConversationBar = conversation !== null && conversation.limit !== null;
  const hasMonthBar = user !== null && user.limit !== null;
  const blocked = blockingLimit(usage, { memo: defenceMemo });
  const warn = conversation?.state === 'warning' || user?.state === 'warning';
  const monthDate = user?.resetsAt ? formatDate(user.resetsAt, locale) : '';
  const billing = user?.billing === true;

  const message =
    blocked === 'plan_tokens'
      ? t('exhaustedPlan')
      : blocked === 'no_plan'
        ? t('exhaustedNoPlan')
        : blocked === 'monthly_tokens'
          ? t('exhaustedMonth', { date: monthDate })
          : blocked === 'conversation_tokens'
            ? t('exhaustedConversationTokens')
            : blocked === 'conversation_messages'
              ? t('exhaustedConversationMessages')
              : warn
                ? user?.state === 'warning'
                  ? billing
                    ? t('warningPlan')
                    : t('warningMonth', { date: monthDate })
                  : t('warningConversation')
                : null;

  if (!hasConversationBar && !hasMonthBar && !message) return null;

  const showBuy =
    billing && (blocked === 'plan_tokens' || blocked === 'no_plan' || user?.state === 'warning');
  const showNew = blocked === 'conversation_tokens' || blocked === 'conversation_messages';
  const fg = blocked ? colors.error : colors.warning;

  return (
    <View accessibilityLabel={t('label')} style={styles.wrap}>
      {hasConversationBar || hasMonthBar ? (
        <View style={styles.meters}>
          {conversation && conversation.limit !== null ? (
            <Meter
              label={t('conversation')}
              text={t('tokens', {
                used: formatNumber(conversation.used),
                limit: formatNumber(conversation.limit),
              })}
              used={conversation.used}
              limit={conversation.limit}
              state={conversation.tokensState}
            />
          ) : null}
          {user && user.limit !== null ? (
            <Meter
              label={billing ? t('plan') : t('month')}
              text={t('tokens', {
                used: formatNumber(user.used),
                limit: formatNumber(user.limit),
              })}
              used={user.used}
              limit={user.limit}
              state={user.state}
            />
          ) : null}
        </View>
      ) : null}

      {message ? (
        <View
          accessibilityRole={blocked ? 'alert' : undefined}
          style={[styles.banner, { backgroundColor: blocked ? colors.errorBg : colors.warningBg }]}
        >
          <WarningCircle size={16} color={fg} />
          <AppText
            variant="small"
            weight={blocked ? 600 : 400}
            style={[styles.message, { color: fg }]}
          >
            {message}
          </AppText>
          {showBuy ? (
            <Pressable accessibilityRole="link" onPress={() => router.push('/billing')} hitSlop={8}>
              <AppText variant="small" weight={700} style={{ color: fg, textDecorationLine: 'underline' }}>
                {t('buyMore')}
              </AppText>
            </Pressable>
          ) : null}
          {showNew ? (
            <Pressable accessibilityRole="link" onPress={onNewConversation} hitSlop={8}>
              <AppText variant="small" weight={700} style={{ color: fg, textDecorationLine: 'underline' }}>
                {t('newConversation')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** This month's tokens against the quota, for the account area. Nothing when there is no quota. */
export function MonthUsage({ usage }: { usage: UserPeriodUsage | null }) {
  const t = useT('chat.usage');
  if (!usage || usage.limit === null) return null;
  return (
    <View style={styles.month}>
      <Meter
        label={usage.billing && usage.plan ? usage.plan.name : t('month')}
        text={t('tokens', { used: formatNumber(usage.used), limit: formatNumber(usage.limit) })}
        used={usage.used}
        limit={usage.limit}
        state={usage.state}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  meters: { flexDirection: 'row', gap: 16 },
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  message: { flex: 1, minWidth: 160 },
  month: { paddingHorizontal: 8, paddingTop: 12 },
});
