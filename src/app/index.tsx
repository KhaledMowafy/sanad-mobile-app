import { Redirect } from 'expo-router';
import { useAuth } from '@/stores/auth-store';

/** The front door: signed-in people go to their conversations, everyone else to the welcome page. */
export default function Index() {
  const status = useAuth((s) => s.status);
  return <Redirect href={status === 'signedIn' ? '/chat' : '/welcome'} />;
}
