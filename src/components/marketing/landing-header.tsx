import { useRouter } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LanguageButton, ThemeButton } from '@/components/prefs-buttons';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { useT } from '@/i18n/use-t';
import { useTheme } from '@/theme/theme';

/** The top of the welcome page: the mark, language and appearance, and the way in. */
export function LandingHeader() {
  const router = useRouter();
  const t = useT('nav');
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  // On the narrowest phones only one button fits beside the other controls.
  const compact = width < 400;

  return (
    <View style={[styles.bar, { borderBottomColor: colors.border, backgroundColor: colors.bg }]}>
      <Logo height={26} />
      <View style={styles.spacer} />
      <LanguageButton />
      <ThemeButton />
      <Button label={t('signIn')} variant="secondary" onPress={() => router.push('/signin')} />
      {compact ? null : <Button label={t('signUp')} onPress={() => router.push('/signup')} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  spacer: { flex: 1 },
});
