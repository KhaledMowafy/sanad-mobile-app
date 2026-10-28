import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/stores/auth-store';
import { useTheme } from '@/theme/theme';

/** The pages for people who are not signed in. A signed-in person is sent to their conversations. */
export default function PublicLayout() {
  const status = useAuth((s) => s.status);
  const { colors } = useTheme();
  if (status === 'signedIn') return <Redirect href="/chat" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
