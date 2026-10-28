import { Redirect, Stack, useGlobalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sidebar } from '@/components/chat/sidebar';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useT } from '@/i18n/use-t';
import { useAuth } from '@/stores/auth-store';
import { useLimits } from '@/stores/limits-store';
import { useTheme } from '@/theme/theme';

/** The signed-in app. Anyone else is sent to the welcome page. */
export default function AppLayout() {
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);
  const loadLimits = useLimits((s) => s.load);
  const { colors } = useTheme();
  const t = useT('mobile');
  const router = useRouter();
  const { id } = useGlobalSearchParams<{ id?: string }>();

  useEffect(() => {
    if (status === 'signedIn') void loadLimits();
  }, [status, loadLimits]);

  if (status === 'signedOut') return <Redirect href="/welcome" />;

  if (status !== 'signedIn') {
    // The service could not be reached: that is not a sign-out, so offer a retry.
    return (
      <Screen contentStyle={styles.center}>
        <Banner tone="error">{t('unavailable')}</Banner>
        <Button label={t('retry')} onPress={() => void bootstrap()} />
      </Screen>
    );
  }

  return (
    <View style={styles.fill}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      />
      <Sidebar
        activeId={id && id !== 'new' ? id : null}
        onOpen={(conversation) => router.navigate(`/chat/${conversation}`)}
        onNew={() => router.navigate('/chat/new')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', gap: 16, padding: 24 },
});
