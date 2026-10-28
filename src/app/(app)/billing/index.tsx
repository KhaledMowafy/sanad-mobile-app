import { useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, ArrowRight } from 'phosphor-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { PlanCard } from '@/components/billing/plan-card';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { AppText } from '@/components/ui/text';
import {
  canBuyPack,
  planAction,
  type Catalogue,
  type PayMethod,
  type Payment,
  type SubscriptionInfo,
} from '@/domain/entities/billing';
import { useT } from '@/i18n/use-t';
import { getContainer } from '@/infrastructure/di/container';
import { formatDate, formatEgp, formatNumber } from '@/presentation/lib/format';
import { useTheme } from '@/theme/theme';
import { radius, size } from '@/theme/tokens';

interface Data {
  catalogue: Catalogue | null;
  info: SubscriptionInfo | null;
  payments: readonly Payment[];
}

const TONE = { PAID: 'success', PENDING: 'muted', FAILED: 'error', REFUNDED: 'warning' } as const;

/** Plans, top-ups and payment history, with the current plan at the top. */
export default function Billing() {
  const t = useT('billing');
  const history = useT('billing.history');
  const mobile = useT('mobile');
  const router = useRouter();
  const { colors, locale, rtl } = useTheme();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [method, setMethod] = useState<PayMethod>('card');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { useCases } = getContainer();
    const [catalogue, info, payments] = await Promise.all([
      useCases.getCatalogue.execute(),
      useCases.getSubscription.execute(),
      useCases.listPayments.execute(),
    ]);
    if (!catalogue.ok) return setFailed(true);
    setFailed(false);
    setData({
      catalogue: catalogue.value,
      info: info.ok ? info.value : null,
      payments: payments.ok ? payments.value : [],
    });
  }, []);

  // Reload when coming back from the payment page or the return screen.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Coming back to the app after paying in the browser: go and read what the backend says.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pendingRef.current) {
        const id = pendingRef.current;
        pendingRef.current = null;
        setPending(null);
        router.push({ pathname: '/billing/return', params: { payment: id } });
      }
    });
    return () => subscription.remove();
  }, [router]);

  const pay = async (key: string, input: { planCode?: string; packCode?: string }) => {
    setBusy(key);
    setError(null);
    const result = await getContainer().useCases.startCheckout.execute({ ...input, method });
    if (!result.ok) {
      setBusy(null);
      const kind = result.error.kind;
      setError(kind === 'network' ? 'network' : kind === 'unauthenticated' ? 'unauthenticated' : 'invalid');
      return;
    }
    pendingRef.current = result.value.paymentId;
    setPending(result.value.paymentId);
    setBusy(null);
    await WebBrowser.openBrowserAsync(result.value.checkoutUrl);
    // On iOS the promise settles when the sheet is closed; the app-state listener covers the rest.
    if (pendingRef.current) {
      const id = pendingRef.current;
      pendingRef.current = null;
      setPending(null);
      router.push({ pathname: '/billing/return', params: { payment: id } });
    }
  };

  const info = data?.info ?? null;
  const subscription = info?.subscription ?? null;
  const planName = subscription?.plan?.name ?? (subscription?.status === 'TRIAL' ? t('trial') : null);
  const end = info?.period?.end ?? subscription?.paidUntil ?? null;
  const billingOn = info?.billingEnabled ?? true;
  // Staff, and accounts with a fixed quota, are not limited by a plan and have nothing to buy.
  const canBuy = billingOn && (info?.billed ?? true);

  const errorText = error ? (t.has(`errors.${error}`) ? t(`errors.${error}`) : t('errors.invalid')) : null;
  const Back = rtl ? ArrowRight : ArrowLeft;

  const paymentName = (payment: Payment): string => {
    const code = payment.planCode ?? payment.packCode;
    const found =
      data?.catalogue?.plans.find((p) => p.code === payment.planCode)?.name ??
      data?.catalogue?.packs.find((p) => p.code === payment.packCode)?.name;
    const purpose = history.has(`purposes.${payment.purpose}`)
      ? history(`purposes.${payment.purpose}`)
      : payment.purpose;
    return `${purpose}${found || code ? `: ${found ?? code}` : ''}`;
  };

  return (
    <Screen edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <IconButton label={mobile('back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat/new'))}>
          <Back size={22} color={colors.textMuted} />
        </IconButton>
        <AppText variant="h4" style={styles.grow} accessibilityRole="header">
          {t('title')}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="lead" tone="muted">
          {t('intro')}
        </AppText>

        {failed ? (
          <View style={styles.stack}>
            <Banner tone="error">{mobile('unavailable')}</Banner>
            <Button variant="secondary" label={mobile('retry')} onPress={() => void load()} />
          </View>
        ) : !data ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            {!billingOn ? (
              <Banner tone="warning">{t('notices.disabled')}</Banner>
            ) : !canBuy ? (
              <Banner tone="info">{t('notices.staff')}</Banner>
            ) : (
              <Card>
                <AppText variant="small" tone="muted">
                  {t('current')}
                </AppText>
                <AppText variant="h4">{planName ?? t('noPlan')}</AppText>
                <View style={styles.wrapRow}>
                  {subscription ? (
                    <AppText variant="caption" weight={600} tone="primary">
                      {t(`statuses.${subscription.status}`)}
                    </AppText>
                  ) : null}
                  {end ? (
                    <AppText variant="small" tone="muted">
                      {formatDate(end, locale)}
                    </AppText>
                  ) : null}
                </View>
              </Card>
            )}

            {errorText ? <Banner tone="error">{errorText}</Banner> : null}

            {pending ? (
              <Banner
                tone="info"
                action={
                  <Button
                    variant="secondary"
                    label={mobile('billing.checkPayment')}
                    onPress={() => {
                      pendingRef.current = null;
                      setPending(null);
                      router.push({ pathname: '/billing/return', params: { payment: pending } });
                    }}
                  />
                }
              >
                {mobile('billing.browserHint')}
              </Banner>
            ) : null}

            {canBuy ? (
              <View style={styles.stack} accessibilityRole="radiogroup">
                <AppText variant="small" weight={600} tone="muted">
                  {t('method')}
                </AppText>
                <View style={styles.wrapRow}>
                  {(['card', 'wallet'] as const).map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: method === value }}
                      accessibilityLabel={t(`methods.${value}`)}
                      onPress={() => setMethod(value)}
                      style={[
                        styles.method,
                        {
                          borderColor: method === value ? colors.primary : colors.borderStrong,
                          backgroundColor: method === value ? colors.primarySoft : 'transparent',
                        },
                      ]}
                    >
                      <AppText variant="small" weight={500}>
                        {t(`methods.${value}`)}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.stack}>
              <AppText variant="h3">{t('plans')}</AppText>
              {data.catalogue?.plans.map((plan) => {
                const action = planAction(plan, subscription);
                const inactive = !canBuy || action === 'current' || action === 'later' || busy !== null;
                const primary = action === 'subscribe' || action === 'upgrade';
                return (
                  <PlanCard key={plan.code} plan={plan} highlighted={action === 'current'}>
                    <Button
                      variant={primary ? 'primary' : 'secondary'}
                      block
                      disabled={inactive}
                      loading={busy === `plan:${plan.code}`}
                      label={busy === `plan:${plan.code}` ? t('notices.redirecting') : t(`actions.${action}`)}
                      onPress={() => void pay(`plan:${plan.code}`, { planCode: plan.code })}
                    />
                  </PlanCard>
                );
              })}
              <AppText variant="small" tone="muted">
                {t('estimates')}
              </AppText>
            </View>

            {data.catalogue && data.catalogue.packs.length > 0 ? (
              <View style={styles.stack}>
                <AppText variant="h3">{t('packs.title')}</AppText>
                <AppText tone="muted">{t('packs.intro')}</AppText>
                {data.catalogue.packs.map((pack) => (
                  <Card key={pack.code} style={styles.stack}>
                    <AppText variant="h4">{t('tokens', { count: formatNumber(pack.tokens) })}</AppText>
                    <AppText variant="h3" style={styles.number}>
                      {formatEgp(pack.pricePiastres, locale)}
                    </AppText>
                    <Button
                      block
                      disabled={!canBuy || !canBuyPack(subscription) || busy !== null}
                      loading={busy === `pack:${pack.code}`}
                      label={busy === `pack:${pack.code}` ? t('notices.redirecting') : t('packs.buy')}
                      onPress={() => void pay(`pack:${pack.code}`, { packCode: pack.code })}
                    />
                  </Card>
                ))}
                {canBuy && !canBuyPack(subscription) ? (
                  <AppText variant="small" tone="muted">
                    {t('packs.needPlan')}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            {canBuy ? (
              <AppText variant="small" tone="muted">
                {t('notices.secure')}
              </AppText>
            ) : null}

            <View style={styles.stack}>
              <AppText variant="h3">{history('title')}</AppText>
              {data.payments.length === 0 ? (
                <AppText variant="small" tone="muted">
                  {history('empty')}
                </AppText>
              ) : (
                data.payments.map((payment) => (
                  <View key={payment.id} style={[styles.payment, { borderColor: colors.border }]}>
                    <View style={styles.grow}>
                      <AppText variant="small" weight={600}>
                        {paymentName(payment)}
                      </AppText>
                      <AppText variant="caption" tone="subtle">
                        {formatDate(payment.paidAt ?? payment.createdAt, locale)}
                      </AppText>
                    </View>
                    <View style={styles.end}>
                      <AppText variant="small" style={styles.number}>
                        {payment.amountPiastres === 0
                          ? history('free')
                          : formatEgp(payment.amountPiastres, locale)}
                      </AppText>
                      <AppText variant="caption" weight={600} tone={TONE[payment.status] ?? 'muted'}>
                        {history.has(`statuses.${payment.status}`)
                          ? history(`statuses.${payment.status}`)
                          : payment.status}
                      </AppText>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 56,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  grow: { flex: 1 },
  content: { padding: 16, gap: 20, paddingBottom: 48 },
  stack: { gap: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  method: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    minHeight: size.control,
    justifyContent: 'center',
  },
  number: { fontVariant: ['tabular-nums'] },
  payment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  end: { alignItems: 'flex-end', gap: 2 },
});
