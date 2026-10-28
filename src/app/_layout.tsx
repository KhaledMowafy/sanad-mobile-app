import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyDirection } from '@/presentation/direction';
import { useAuth } from '@/stores/auth-store';
import { usePrefs } from '@/stores/prefs-store';
import { ThemeProvider, useTheme } from '@/theme/theme';

void SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      />
    </>
  );
}

/**
 * The root of the app. It keeps the splash screen up until the fonts are loaded, the saved
 * language and theme are read, the text direction matches the language, and the saved session
 * has been checked, so the first screen is never the wrong one.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });
  const prefsReady = usePrefs((s) => s.ready);
  const locale = usePrefs((s) => s.locale);
  const hydrate = usePrefs((s) => s.hydrate);
  const authStatus = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);
  const [direction, setDirection] = useState<'pending' | 'ready' | 'reloading'>('pending');

  useEffect(() => {
    void hydrate();
    void bootstrap();
  }, [hydrate, bootstrap]);

  useEffect(() => {
    if (!prefsReady) return;
    void applyDirection(locale).then((reloading) => setDirection(reloading ? 'reloading' : 'ready'));
  }, [prefsReady, locale]);

  const ready = fontsLoaded && prefsReady && direction === 'ready' && authStatus !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Navigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
