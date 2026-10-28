import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { isRtl, type Locale } from '@/i18n';
import { usePrefs } from '@/stores/prefs-store';
import { darkColors, lightColors, type Colors } from './tokens';

export type FontWeight = 400 | 500 | 600 | 700;

export interface Theme {
  readonly colors: Colors;
  readonly scheme: 'light' | 'dark';
  readonly locale: Locale;
  readonly rtl: boolean;
  /** The font family for a weight, in the script of the chosen language. */
  readonly font: (weight?: FontWeight) => string;
}

const ARABIC: Record<FontWeight, string> = {
  400: 'IBMPlexSansArabic_400Regular',
  500: 'IBMPlexSansArabic_500Medium',
  600: 'IBMPlexSansArabic_600SemiBold',
  700: 'IBMPlexSansArabic_700Bold',
};

const LATIN: Record<FontWeight, string> = {
  400: 'IBMPlexSans_400Regular',
  500: 'IBMPlexSans_500Medium',
  600: 'IBMPlexSans_600SemiBold',
  700: 'IBMPlexSans_700Bold',
};

const ThemeContext = createContext<Theme | null>(null);

/** Colours, direction and fonts for every screen. Dark follows the phone unless a choice was made. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const preference = usePrefs((s) => s.theme);
  const locale = usePrefs((s) => s.locale);

  const theme = useMemo<Theme>(() => {
    const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    const families = locale === 'ar' ? ARABIC : LATIN;
    return {
      colors: scheme === 'dark' ? darkColors : lightColors,
      scheme,
      locale,
      rtl: isRtl(locale),
      font: (weight = 400) => families[weight],
    };
  }, [preference, system, locale]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme needs a ThemeProvider');
  return theme;
}
