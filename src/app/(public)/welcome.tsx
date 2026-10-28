import { ScrollView, StyleSheet, View } from 'react-native';
import { Compare, Faq, Features, HowItWorks, Pricing, PrivacyPanel } from '@/components/marketing/sections';
import { Footer } from '@/components/marketing/footer';
import { HeroAsk } from '@/components/marketing/hero-ask';
import { LandingHeader } from '@/components/marketing/landing-header';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { AppText } from '@/components/ui/text';
import { useT } from '@/i18n/use-t';
import { useAuth } from '@/stores/auth-store';

/** The welcome page: what the product is, what it does, what it costs, and the way in. */
export default function Welcome() {
  const t = useT('hero');
  const mobile = useT('mobile');
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);

  return (
    <Screen edges={['top']}>
      <LandingHeader />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {status === 'unavailable' ? (
          <View style={styles.notice}>
            <Banner
              tone="warning"
              action={<Button variant="secondary" label={mobile('retry')} onPress={() => void bootstrap()} />}
            >
              {mobile('unavailable')}
            </Banner>
          </View>
        ) : null}

        <View style={styles.hero}>
          <AppText variant="display" align="center" accessibilityRole="header" style={styles.title}>
            {t('title')}
          </AppText>
          <AppText variant="lead" tone="muted" align="center">
            {t('body')}
          </AppText>
          <View style={styles.ask}>
            <HeroAsk />
          </View>
        </View>

        <Features />
        <Compare />
        <HowItWorks />
        <Pricing />
        <PrivacyPanel />
        <Faq />
        <Footer />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { padding: 16, paddingBottom: 0 },
  hero: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 36, gap: 14 },
  title: { fontSize: 32, lineHeight: 50 },
  ask: { paddingTop: 12 },
});
