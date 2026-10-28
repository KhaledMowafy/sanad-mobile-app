import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Logo } from '@/components/ui/logo';
import { AppText } from '@/components/ui/text';
import { useT } from '@/i18n/use-t';
import { useTheme } from '@/theme/theme';

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.link}>
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
    </Pressable>
  );
}

export function Footer() {
  const t = useT('footer');
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { borderTopColor: colors.border }]}>
      <Logo height={26} />
      <AppText variant="small" tone="muted">
        {t('tagline')}
      </AppText>

      <View style={styles.columns}>
        <View style={styles.column}>
          <AppText variant="small" weight={600}>
            {t('account')}
          </AppText>
          <FooterLink label={t('signIn')} onPress={() => router.push('/signin')} />
          <FooterLink label={t('signUp')} onPress={() => router.push('/signup')} />
        </View>
        <View style={styles.column}>
          <AppText variant="small" weight={600}>
            {t('legal')}
          </AppText>
          <FooterLink label={t('terms')} onPress={() => router.push('/legal?kind=terms')} />
          <FooterLink
            label={t('privacyPolicy')}
            onPress={() => router.push('/legal?kind=privacy')}
          />
        </View>
      </View>

      <AppText variant="caption" tone="subtle">
        {t('rights', { year: new Date().getFullYear() })}
      </AppText>
      <AppText variant="caption" tone="subtle">
        {t('disclaimer')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingHorizontal: 16, paddingVertical: 28, borderTopWidth: StyleSheet.hairlineWidth },
  columns: { flexDirection: 'row', gap: 40, paddingVertical: 8 },
  column: { gap: 2 },
  link: { minHeight: 36, justifyContent: 'center' },
});
