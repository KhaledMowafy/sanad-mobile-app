import { Redirect } from 'expo-router';

/** /chat is a new conversation. */
export default function ChatIndex() {
  return <Redirect href="/chat/new" />;
}
