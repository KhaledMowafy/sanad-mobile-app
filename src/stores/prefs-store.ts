import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { DEFAULT_LOCALE, type Locale } from '@/i18n';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'sanadak_prefs_v1';

interface PrefsState {
  /** False until the stored choice has been read, so the first screen never flashes the wrong language. */
  ready: boolean;
  locale: Locale;
  theme: ThemePreference;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const usePrefs = create<PrefsState>((set, get) => {
  const persist = () => {
    const { locale, theme } = get();
    void AsyncStorage.setItem(KEY, JSON.stringify({ locale, theme })).catch(() => undefined);
  };

  return {
    ready: false,
    locale: DEFAULT_LOCALE,
    theme: 'system',

    hydrate: async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const stored = raw ? (JSON.parse(raw) as { locale?: unknown; theme?: unknown }) : {};
        set({
          locale: stored.locale === 'en' || stored.locale === 'ar' ? stored.locale : DEFAULT_LOCALE,
          theme:
            stored.theme === 'light' || stored.theme === 'dark' || stored.theme === 'system'
              ? stored.theme
              : 'system',
          ready: true,
        });
      } catch {
        set({ ready: true });
      }
    },

    setLocale: (locale) => {
      set({ locale });
      persist();
    },

    setTheme: (theme) => {
      set({ theme });
      persist();
    },
  };
});
