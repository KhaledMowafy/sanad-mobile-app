import { CircleHalf, Moon, Sun } from 'phosphor-react-native';
import { IconButton } from '@/components/ui/icon-button';
import { AppText } from '@/components/ui/text';
import { Pressable, StyleSheet } from 'react-native';
import { useT } from '@/i18n/use-t';
import { usePrefs, type ThemePreference } from '@/stores/prefs-store';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

const NEXT: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

/** Cycles the appearance: follow the device, light, dark. */
export function ThemeButton() {
  const t = useT('mobile');
  const { colors } = useTheme();
  const theme = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);
  const Glyph = theme === 'dark' ? Moon : theme === 'light' ? Sun : CircleHalf;
  const name =
    theme === 'dark' ? t('themeDark') : theme === 'light' ? t('themeLight') : t('themeSystem');

  return (
    <IconButton label={`${t('theme')}: ${name}`} onPress={() => setTheme(NEXT[theme])}>
      <Glyph size={22} color={colors.textMuted} />
    </IconButton>
  );
}

/**
 * Switches between Arabic and English. React Native fixes the layout direction when the app
 * starts, so the root layout reloads the app after the change; the saved choice survives it.
 */
export function LanguageButton() {
  const t = useT('mobile');
  const { colors } = useTheme();
  const locale = usePrefs((s) => s.locale);
  const setLocale = usePrefs((s) => s.setLocale);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('language')}: ${t('otherLanguageName')}`}
      onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      style={({ pressed }) => [
        styles.language,
        { backgroundColor: pressed ? colors.surfaceHover : 'transparent' },
      ]}
    >
      <AppText variant="small" weight={600} tone="muted">
        {t('otherLanguageName')}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  language: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
});
