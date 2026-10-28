import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle, Clock, WarningCircle } from 'phosphor-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { AppText } from '@/components/ui/text';
import type { Payment } from '@/domain/entities/billing';
import { useT } from '@/i18n/use-t';
import { getContainer } from '@/infrastructure/di/container';
import { useAuth } from '@/stores/auth-store';
import { useTheme } from '@/theme/theme';

const POLL_MS = 2000;
/** The notification usually lands within seconds; a minute is long enough to say "still waiting". */
const MAX_POLLS = 30;

function Shell({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body?: string | null | undefined;
  children?: ReactNode;
}) {
  return (
    <Screen contentStyle={styles.shell}>
      {icon}
      <AppText variant="h2" align="center" accessibilityRole="header" accessibilityLiveRegion="polite">
        {title}
      </AppText>
      {body ? (
        <AppText tone="muted" align="center">
          {body}
        </AppText>
      ) : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </Screen>
  );
}

/**
 * Where the customer lands after the payment page. The browser can be told anything, so it only
 * names the payment: the status shown here is read from the backend, which marks a payment paid
 * only on the gateway's signed notification.
 */
export default function PaymentReturn() {
  const t = useT('billing.return');
  const router = useRouter();
  const { colors } = useTheme();
  const refreshUser = useAuth((s) => s.bootstrap);
  const { payment: id } = useLocalSearchParams<{ payment?: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [state, setState] = useState<'checking' | 'waiting' | 'unreadable'>('checking');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      const result = await getContainer().useCases.getPayment.execute(id);
      if (cancelled) return;
      polls += 1;
      const latest = result.ok ? result.value : null;
      if (latest) setPayment(latest);
      if (latest && latest.status !== 'PENDING') {
        // A new plan changes what the sidebar shows, so read the account again.
        if (latest.status === 'PAID') void refreshUser();
        return;
      }
      if (polls >= MAX_POLLS) return setState(latest ? 'waiting' : 'unreadable');
      timer = setTimeout(check, POLL_MS);
    };
    void check();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, refreshUser]);

  const toBilling = () => router.replace('/billing');
  const toChat = () => router.replace('/chat/new');
  const toProfile = () => router.replace('/profile');

  if (!id) {
    return (
      <Shell icon={<WarningCircle size={40} color={colors.error} />} title={t('missing')}>
        <Button label={t('retry')} onPress={toBilling} />
      </Shell>
    );
  }

  if (payment?.status === 'PAID') {
    return (
      <Shell
        icon={<CheckCircle size={40} weight="fill" color={colors.success} />}
        title={t('paid')}
        body={payment.planCode ? t('paidPlan') : t('paidPack')}
      >
        <Button label={t('toProfile')} onPress={toProfile} />
        <Button variant="secondary" label={t('toChat')} onPress={toChat} />
      </Shell>
    );
  }

  if (payment && (payment.status === 'FAILED' || payment.status === 'REFUNDED')) {
    return (
      <Shell
        icon={<WarningCircle size={40} weight="fill" color={colors.error} />}
        title={payment.status === 'REFUNDED' ? t('refunded') : t('failed')}
        body={payment.status === 'FAILED' ? payment.note : undefined}
      >
        <Button label={t('retry')} onPress={toBilling} />
        <Button variant="secondary" label={t('toChat')} onPress={toChat} />
      </Shell>
    );
  }

  if (state !== 'checking') {
    return (
      <Shell
        icon={<Clock size={40} color={colors.textMuted} />}
        title={state === 'waiting' ? t('waiting') : t('unreadable')}
      >
        <Button label={t('toProfile')} onPress={toProfile} />
      </Shell>
    );
  }

  return (
    <Shell icon={<ActivityIndicator size="large" color={colors.primary} />} title={t('checking')} />
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  actions: { gap: 12, alignSelf: 'stretch', marginTop: 8 },
});
