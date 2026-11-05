import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
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
  type Payment,
  type SubscriptionInfo,
} from '@/domain/entities/billing';
import { useT } from '@/i18n/use-t';
import { SITE_URL } from '@/infrastructure/config';
import { getContainer } from '@/infrastructure/di/container';
import { formatDate, formatEgp, formatNumber } from '@/presentation/lib/format';
import { useTheme } from '@/theme/theme';

interface Data {
  catalogue: Catalogue | null;
  info: SubscriptionInfo | null;
  payments: readonly Payment[];
}

const TONE = { PAID: 'success', PENDING: 'muted', FAILED: 'error', REFUNDED: 'warning' } as const;

/**
 * Plans, top-ups and payment history. Paying happens on the website, where the person signs in:
 * every buy button opens it in the browser, and this screen reloads when the app is shown again.
 */
export default function Billing() {
  const t = useT('billing');
  const history = useT('billing.history');
  const mobile = useT('mobile');
  const router = useRouter();
  const { colors, locale, rtl } = useTheme();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

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

  // Reload on every return to this screen, such as coming back from the browser after paying.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** Arabic lives at the root of the site and English under /en. */
  const openWebsite = () => {
    const path = locale === 'en' ? '/en/billing' : '/billing';
    void Linking.openURL(`${SITE_URL}${path}`).catch(() => undefined);
  };

  const info = data?.info ?? null;
  const subscription = info?.subscription ?? null;
  const planName = subscription?.plan?.name ?? (subscription?.status === 'TRIAL' ? t('trial') : null);
  const end = info?.period?.end ?? subscription?.paidUntil ?? null;
  const billingOn = info?.billingEnabled ?? true;
  // Staff, and accounts with a fixed quota, are not limited by a plan and have nothing to buy.
  const canBuy = billingOn && (info?.billed ?? true);
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
        <IconButton
          label={mobile('back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat/new'))}
        >
          <Back size={22} color={colors.textMuted} />
        </IconButton>
        <AppText variant="h4" style={styles.grow} accessibilityRole="header">
          {t('title')}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
              <>
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

                <Banner tone="info">{mobile('billing.hint')}</Banner>
                <View style={styles.stack}>
                  <Button label={mobile('billing.subscribe')} onPress={openWebsite} block />
                  <Button
                    variant="secondary"
                    label={mobile('billing.refresh')}
                    onPress={() => void load()}
                    block
                  />
                </View>
              </>
            )}

            <View style={styles.stack}>
              <AppText variant="h3">{t('plans')}</AppText>
              {data.catalogue?.plans.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  highlighted={planAction(plan, subscription) === 'current'}
                />
              ))}
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
                  </Card>
                ))}
                {canBuy ? (
                  canBuyPack(subscription) ? (
                    <Button
                      variant="secondary"
                      label={mobile('billing.topup')}
                      onPress={openWebsite}
                      block
                    />
                  ) : (
                    <AppText variant="small" tone="muted">
                      {t('packs.needPlan')}
                    </AppText>
                  )
                ) : null}
              </View>
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
