import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, SignOut } from 'phosphor-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import type { ProfileDto } from '@/application/dto/dto';
import { LanguageButton, ThemeButton } from '@/components/prefs-buttons';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Meter } from '@/components/ui/meter';
import { Screen } from '@/components/ui/screen';
import { AppText } from '@/components/ui/text';
import { canBuyPack, type SubscriptionInfo } from '@/domain/entities/billing';
import type { TokenCount } from '@/domain/entities/usage';
import { useT } from '@/i18n/use-t';
import { getContainer } from '@/infrastructure/di/container';
import { formatDate, formatDateTime, formatNumber } from '@/presentation/lib/format';
import { useAuth } from '@/stores/auth-store';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

function Row({ label, children }: { label: string; children: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
      <AppText>{children}</AppText>
    </View>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <Card accessibilityLabel={title} style={styles.section}>
      <View style={styles.gap4}>
        <AppText variant="h3" accessibilityRole="header">
          {title}
        </AppText>
        {intro ? (
          <AppText variant="small" tone="muted">
            {intro}
          </AppText>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

/** The plan the account is on, what it holds, and the way to change it or buy more tokens. */
function PlanSection({ info }: { info: SubscriptionInfo }) {
  const t = useT('profile.plan');
  const billing = useT('billing');
  const router = useRouter();
  const { locale } = useTheme();
  const subscription = info.subscription;
  const planName = subscription?.plan?.name ?? (subscription?.status === 'TRIAL' ? billing('trial') : null);
  const end = info.period?.end ?? subscription?.paidUntil ?? null;
  const pages = info.usage?.pages ?? null;

  return (
    <Section title={t('title')}>
      {!info.billingEnabled ? (
        <AppText variant="small" tone="muted">
          {t('off')}
        </AppText>
      ) : !info.billed ? (
        <AppText variant="small" tone="muted">
          {t('managed')}
        </AppText>
      ) : (
        <>
          <View style={styles.wrapRow}>
            <AppText variant="h2">{planName ?? t('none')}</AppText>
            {subscription ? (
              <AppText variant="caption" weight={600} tone="primary">
                {billing(`statuses.${subscription.status}`)}
              </AppText>
            ) : null}
          </View>
          {end ? (
            <AppText variant="small" tone="muted">
              {subscription?.status === 'CANCELED' || !subscription?.autoRenew ? t('ends') : t('renews')}{' '}
              {formatDate(end, locale)}
            </AppText>
          ) : null}

          {info.period ? (
            <View style={styles.gap8}>
              <Stat label={t('planTokens')} value={formatNumber(info.period.tokens)} />
              <Stat label={t('carried')} value={formatNumber(info.period.topupCarried)} />
            </View>
          ) : null}

          {pages && pages.limit !== null ? (
            <Meter
              label={t('pages')}
              text={`${formatNumber(pages.used)} / ${formatNumber(pages.limit)}`}
              used={pages.used}
              limit={pages.limit}
              state={pages.state}
            />
          ) : null}

          <View style={styles.gap8}>
            <Button
              label={planName && subscription?.plan ? t('change') : t('choose')}
              onPress={() => router.push('/billing')}
              block
            />
            {canBuyPack(subscription) ? (
              <Button variant="secondary" label={t('topup')} onPress={() => router.push('/billing')} block />
            ) : (
              <AppText variant="small" tone="muted">
                {t('needPlan')}
              </AppText>
            )}
          </View>
        </>
      )}
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
      <AppText weight={600} style={styles.number}>
        {value}
      </AppText>
    </View>
  );
}

function Breakdown({ title, count }: { title: string; count: TokenCount }) {
  const t = useT('profile.usage');
  return (
    <View style={styles.gap8}>
      <AppText variant="h4">{title}</AppText>
      <Stat label={t('prompt')} value={formatNumber(count.prompt)} />
      <Stat label={t('completion')} value={formatNumber(count.completion)} />
      <Stat label={t('total')} value={formatNumber(count.total)} />
    </View>
  );
}

function UsageSection({ usage }: { usage: NonNullable<ProfileDto['usage']> }) {
  const t = useT('profile.usage');
  const { colors, locale } = useTheme();
  const { period } = usage;
  const kinds = Object.entries(usage.byKind).sort((a, b) => b[1].total - a[1].total);
  const stateTone = period.state === 'ok' ? 'success' : period.state === 'warning' ? 'warning' : 'error';
  const tokens = (count: number) => t('tokens', { count: formatNumber(count) });

  return (
    <>
      <View style={[styles.summary, { backgroundColor: colors.surfaceSunken }]}>
        <View style={styles.between}>
          <View style={styles.gap4}>
            <AppText variant="small" tone="muted">
              {period.billing ? t('remainingPlan') : t('remaining')}
            </AppText>
            <AppText variant="h1" style={styles.number}>
              {period.remaining === null ? t('unlimited') : formatNumber(period.remaining)}
            </AppText>
            {period.remaining !== null ? (
              <AppText variant="small" tone="muted">
                {t('unit')}
              </AppText>
            ) : null}
          </View>
          <AppText variant="small" weight={600} tone={stateTone}>
            {t(`states.${period.state}`)}
          </AppText>
        </View>

        {period.limit !== null ? (
          <Meter
            label={t('used')}
            text={`${formatNumber(period.used)} / ${formatNumber(period.limit)}`}
            used={period.used}
            limit={period.limit}
            state={period.state}
          />
        ) : null}

        <Stat label={t('used')} value={tokens(period.used)} />
        <Stat label={t('limit')} value={period.limit === null ? t('noLimit') : tokens(period.limit)} />
        <Stat label={t('period')} value={formatDate(period.periodStart, locale)} />
        <Stat
          label={t('resets')}
          value={period.resetsAt ? formatDate(period.resetsAt, locale) : t('resetsNever')}
        />
      </View>

      <Breakdown title={t('used')} count={usage.thisPeriod} />
      <Breakdown title={t('allTime')} count={usage.allTime} />

      <View style={styles.gap8}>
        <AppText variant="h4">{t('byKind')}</AppText>
        {kinds.length === 0 ? (
          <AppText variant="small" tone="muted">
            {t('none')}
          </AppText>
        ) : (
          kinds.map(([kind, count]) => (
            <View key={kind} style={[styles.between, styles.kind, { borderBottomColor: colors.border }]}>
              <View style={styles.gap4}>
                <AppText variant="small" weight={500}>
                  {t.has(`kinds.${kind}`) ? t(`kinds.${kind}`) : kind}
                </AppText>
                <AppText variant="caption" tone="subtle">
                  {t('calls')}: {formatNumber(count.calls)}
                </AppText>
              </View>
              <AppText variant="small" style={styles.number}>
                {formatNumber(count.total)}
              </AppText>
            </View>
          ))
        )}
      </View>
    </>
  );
}

/** The account details and what the account has spent, as the backend states them. */
export default function Profile() {
  const account = useT('profile.account');
  const usageT = useT('profile.usage');
  const chat = useT('chat');
  const mobile = useT('mobile');
  const router = useRouter();
  const { colors, locale, rtl } = useTheme();
  const signOut = useAuth((s) => s.signOut);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const { useCases } = getContainer();
    const [account_, subscription] = await Promise.all([
      useCases.getProfile.execute(),
      useCases.getSubscription.execute(),
    ]);
    if (!account_.ok) return setFailed(true);
    setFailed(false);
    setProfile(account_.value);
    setInfo(subscription.ok ? subscription.value : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const dateTime = (iso: string | null) => (iso ? formatDateTime(iso, locale) : account('unknown'));
  const known = (group: 'roles' | 'providers', value: string | null) => {
    if (!value) return account('unknown');
    const key = `${group}.${value.toUpperCase()}`;
    return account.has(key) ? account(key) : value;
  };
  const flag = (value: boolean | null, yes: string, no: string) =>
    value === null ? account('unknown') : value ? yes : no;
  const Back = rtl ? ArrowRight : ArrowLeft;

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
          {account('title')}
        </AppText>
        <LanguageButton />
        <ThemeButton />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {failed ? (
          <View style={styles.gap12}>
            <Banner tone="error">{mobile('unavailable')}</Banner>
            <Button variant="secondary" label={mobile('retry')} onPress={() => void load()} />
          </View>
        ) : !profile ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <View style={styles.identity}>
              <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                <AppText variant="h3" tone="primary">
                  {profile.user.initial}
                </AppText>
              </View>
              <View style={styles.grow}>
                <AppText variant="h3" numberOfLines={1}>
                  {profile.user.name}
                </AppText>
                <AppText tone="muted" numberOfLines={1} style={styles.ltr}>
                  {profile.user.email}
                </AppText>
              </View>
            </View>

            <Section title={account('title')}>
              <View>
                <Row label={account('name')}>{profile.user.name}</Row>
                <Row label={account('email')}>{profile.user.email}</Row>
                <Row label={account('role')}>{known('roles', profile.role)}</Row>
                <Row label={account('provider')}>{known('providers', profile.provider)}</Row>
                <Row label={account('verified')}>
                  {flag(profile.isVerified, account('yes'), account('no'))}
                </Row>
                <Row label={account('status')}>
                  {flag(profile.isActive, account('active'), account('inactive'))}
                </Row>
                <Row label={account('createdAt')}>{dateTime(profile.createdAt)}</Row>
                <Row label={account('lastLogin')}>{dateTime(profile.lastLogin)}</Row>
              </View>
            </Section>

            {info ? <PlanSection info={info} /> : null}

            <Section title={usageT('title')} intro={usageT('intro')}>
              {profile.usage ? (
                <UsageSection usage={profile.usage} />
              ) : (
                <AppText variant="small" tone="muted">
                  {usageT('unavailable')}
                </AppText>
              )}
            </Section>

            <Button
              variant="secondary"
              label={chat('signOut')}
              icon={<SignOut size={18} color={colors.text} />}
              onPress={() => void signOut()}
              block
            />
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
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ltr: { writingDirection: 'ltr' },
  section: { gap: 16 },
  row: { gap: 2, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  gap4: { gap: 4 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  stat: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  number: { fontVariant: ['tabular-nums'] },
  summary: { borderRadius: radius.lg, padding: 16, gap: 12 },
  kind: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8 },
});
