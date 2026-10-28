import { CaretDown, Check, X } from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PlanCard } from '@/components/billing/plan-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import type { Catalogue } from '@/domain/entities/billing';
import { getContainer } from '@/infrastructure/di/container';
import { useT } from '@/i18n/use-t';
import { formatEgp, formatNumber } from '@/presentation/lib/format';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <View style={styles.sectionHead}>
        <AppText variant="h2" accessibilityRole="header">
          {title}
        </AppText>
        {intro ? (
          <AppText variant="lead" tone="muted">
            {intro}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** What the product offers. */
export function Features() {
  const t = useT('features');
  const { colors } = useTheme();
  const items = t.raw<{ title: string; body: string }[]>('items');

  return (
    <Section title={t('title')} intro={t('intro')}>
      <View style={styles.stack}>
        {items.map((item) => (
          <Card key={item.title} style={styles.feature}>
            <View style={[styles.mark, { backgroundColor: colors.accent }]} />
            <AppText variant="h4">{item.title}</AppText>
            <AppText tone="muted">{item.body}</AppText>
          </Card>
        ))}
      </View>
    </Section>
  );
}

/** Why the product, against a general-purpose assistant. */
export function Compare() {
  const t = useT('compare');
  const { colors } = useTheme();
  const rows = t.raw<{ topic: string; general: string; sanadak: string }[]>('rows');

  return (
    <Section title={t('title')} intro={t('intro')}>
      <View style={styles.stack}>
        {rows.map((row) => (
          <Card key={row.topic} style={styles.compareCard}>
            <AppText variant="h4">{row.topic}</AppText>
            <View style={[styles.verdict, { backgroundColor: colors.errorBg }]}>
              <X size={18} weight="bold" color={colors.error} style={styles.verdictIcon} />
              <View style={styles.verdictText}>
                <AppText variant="small" weight={600} tone="error">
                  {t('general')}
                </AppText>
                <AppText variant="small">{row.general}</AppText>
              </View>
            </View>
            <View style={[styles.verdict, { backgroundColor: colors.successBg }]}>
              <Check size={18} weight="bold" color={colors.success} style={styles.verdictIcon} />
              <View style={styles.verdictText}>
                <AppText variant="small" weight={600} tone="success">
                  {t('sanadak')}
                </AppText>
                <AppText variant="small">{row.sanadak}</AppText>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Section>
  );
}

/** Three steps from a question to its source. */
export function HowItWorks() {
  const t = useT('how');
  const { colors } = useTheme();
  const steps = t.raw<{ title: string; body: string }[]>('steps');
  const articles = t.raw<string[]>('demoArticles');

  return (
    <Section title={t('title')} intro={t('intro')}>
      <View style={styles.stack}>
        {steps.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <View style={[styles.mark, { backgroundColor: colors.accent, height: 26 }]} />
            <View style={styles.stepBody}>
              <AppText variant="h4">{step.title}</AppText>
              <AppText tone="muted">{step.body}</AppText>
              {index === 0 ? (
                <View
                  style={[
                    styles.demo,
                    { borderColor: colors.borderStrong, backgroundColor: colors.surface },
                  ]}
                >
                  <AppText variant="small">{t('demoQuestion')}</AppText>
                </View>
              ) : null}
              {index === 1 ? (
                <View style={styles.chips}>
                  {articles.map((article) => (
                    <View
                      key={article}
                      style={[styles.chip, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
                    >
                      <AppText variant="caption" weight={500}>
                        {t('demoLaw')} {article}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
              {index === 2 ? (
                <View style={styles.chips}>
                  {[t('copyWithReferences'), t('exportToMemo')].map((label) => (
                    <View
                      key={label}
                      style={[styles.chip, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
                    >
                      <AppText variant="caption" weight={500}>
                        {label}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </Section>
  );
}

/**
 * The plans. The prices are read from the backend, so one an admin changes shows without a new
 * version of the app. If they cannot be read the section stays out of the way rather than showing
 * stale or invented prices.
 */
export function Pricing() {
  const t = useT('pricing');
  const router = useRouter();
  const { locale } = useTheme();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getContainer()
      .useCases.getCatalogue.execute()
      .then((result) => {
        if (!cancelled && result.ok) setCatalogue(result.value);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!catalogue || catalogue.plans.length === 0) return null;
  const pack = catalogue.packs[0];

  return (
    <Section title={t('title')} intro={t('intro')}>
      <View style={styles.stack}>
        {catalogue.plans.map((plan) => (
          <PlanCard key={plan.code} plan={plan}>
            <Button label={t('cta')} onPress={() => router.push('/signup')} />
          </PlanCard>
        ))}
        {pack ? (
          <AppText tone="muted">
            <AppText weight={600}>{t('topup')}: </AppText>
            {t('topupBody', {
              tokens: formatNumber(pack.tokens),
              price: formatEgp(pack.pricePiastres, locale),
            })}
          </AppText>
        ) : null}
      </View>
    </Section>
  );
}

/** Where the data is processed: a deep pine panel with the path of a question. */
export function PrivacyPanel() {
  const t = useT('privacy');
  const { colors } = useTheme();
  const points = t.raw<string[]>('points');

  return (
    <View style={[styles.panel, { backgroundColor: colors.panel }]}>
      <AppText variant="h2" tone="onPanel" accessibilityRole="header">
        {t('title')}
      </AppText>
      <AppText variant="lead" tone="onPanel" style={styles.panelBody}>
        {t('body')}
      </AppText>
      <View style={styles.panelPoints}>
        {points.map((point) => (
          <View key={point} style={styles.panelPoint}>
            <Check size={20} color={colors.accent} weight="bold" style={styles.verdictIcon} />
            <AppText tone="onPanel" style={styles.verdictText}>
              {point}
            </AppText>
          </View>
        ))}
      </View>

      <View accessible accessibilityLabel={t('flowLabel')} style={styles.flow}>
        <View style={[styles.flowBox, { borderColor: 'rgba(253,254,253,0.25)' }]}>
          <AppText variant="small" weight={600} tone="onPanel">
            {t('you')}
          </AppText>
        </View>
        <AppText variant="caption" tone="onPanel" align="center" style={styles.flowLink}>
          {t('link')}
        </AppText>
        <View style={[styles.flowServer, { borderColor: colors.accent }]}>
          <AppText variant="small" weight={600} style={{ color: colors.accent }}>
            {t('server')}
          </AppText>
          <View style={styles.flowRow}>
            {[t('model'), t('texts')].map((label) => (
              <View key={label} style={styles.flowCell}>
                <AppText variant="caption" weight={500} tone="onPanel">
                  {label}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/** Questions people ask. Tap one to open it. */
export function Faq() {
  const t = useT('faq');
  const { colors } = useTheme();
  const items = t.raw<{ q: string; a: string }[]>('items');
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section title={t('title')}>
      <View style={[styles.faqList, { borderTopColor: colors.border }]}>
        {items.map((item, index) => {
          const expanded = open === index;
          return (
            <View key={item.q} style={[styles.faqItem, { borderBottomColor: colors.border }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setOpen(expanded ? null : index)}
                style={styles.faqQuestion}
              >
                <AppText variant="h4" style={styles.faqQ}>
                  {item.q}
                </AppText>
                <CaretDown
                  size={18}
                  color={colors.textSubtle}
                  style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
                />
              </Pressable>
              {expanded ? (
                <AppText tone="muted" style={styles.faqAnswer}>
                  {item.a}
                </AppText>
              ) : null}
            </View>
          );
        })}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 36, paddingHorizontal: 16, gap: 24 },
  sectionHead: { gap: 8 },
  stack: { gap: 12 },
  feature: { gap: 8 },
  mark: { width: 4, height: 20, borderRadius: 1, transform: [{ skewX: '-18deg' }] },
  compareCard: { gap: 10 },
  verdict: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md },
  verdictIcon: { marginTop: 3 },
  verdictText: { flex: 1, gap: 2 },
  step: { flexDirection: 'row', gap: 12 },
  stepBody: { flex: 1, gap: 8 },
  demo: { borderWidth: 1, borderRadius: radius.lg, padding: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  panel: { marginHorizontal: 16, marginBottom: 36, borderRadius: radius.xl, padding: 24, gap: 16 },
  panelBody: { opacity: 0.85 },
  panelPoints: { gap: 12 },
  panelPoint: { flexDirection: 'row', gap: 10 },
  flow: { gap: 8, paddingTop: 8 },
  flowBox: { borderWidth: 1, borderRadius: radius.lg, padding: 14, backgroundColor: 'rgba(253,254,253,0.08)' },
  flowLink: { opacity: 0.75 },
  flowServer: { borderWidth: 1.5, borderRadius: radius.lg, padding: 14, gap: 10, backgroundColor: 'rgba(7,32,29,0.55)' },
  flowRow: { flexDirection: 'row', gap: 8 },
  flowCell: { flex: 1, borderRadius: radius.md, padding: 10, backgroundColor: 'rgba(253,254,253,0.08)' },
  faqList: { borderTopWidth: StyleSheet.hairlineWidth },
  faqItem: { borderBottomWidth: StyleSheet.hairlineWidth },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 12 },
  faqQ: { flex: 1 },
  faqAnswer: { paddingBottom: 16 },
});
