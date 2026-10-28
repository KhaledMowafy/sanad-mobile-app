import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LanguageButton, ThemeButton } from '@/components/prefs-buttons';
import { IconButton } from '@/components/ui/icon-button';
import { Logo } from '@/components/ui/logo';
import { Screen } from '@/components/ui/screen';
import { AppText } from '@/components/ui/text';
import { useT } from '@/i18n/use-t';
import { useTheme } from '@/theme/theme';

/** The frame every sign-in screen shares: a way back, the mark, a title, and the form. */
export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const t = useT('mobile');
  const { colors, rtl } = useTheme();
  const Back = rtl ? ArrowRight : ArrowLeft;

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <View style={styles.bar}>
        <IconButton
          label={t('back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
        >
          <Back size={22} color={colors.text} />
        </IconButton>
        <View style={styles.spacer} />
        <LanguageButton />
        <ThemeButton />
      </View>

      <View style={styles.body}>
        <Logo kind="lockup" height={56} />
        <View style={styles.heading}>
          <AppText variant="h2" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText tone="muted">{subtitle}</AppText>
          ) : null}
        </View>
        <View style={styles.form}>{children}</View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  spacer: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 12, gap: 20 },
  heading: { gap: 6 },
  form: { gap: 16 },
});
