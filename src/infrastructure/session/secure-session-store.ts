import * as SecureStore from 'expo-secure-store';
import type { Session, SessionStore } from '@/application/ports/auth';

const ACCESS_KEY = 'sanadak_access';
const REFRESH_KEY = 'sanadak_refresh';

/**
 * The session lives in the phone's keychain (iOS) or keystore (Android), never in plain storage.
 * The tokens are also cached in memory, so every request does not wait on the secure store.
 */
export class SecureSessionStore implements SessionStore {
  private cache: Session | null | undefined;

  async read(): Promise<Session | null> {
    if (this.cache !== undefined) return this.cache;
    try {
      const [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
      ]);
      this.cache = accessToken ? { accessToken, refreshToken: refreshToken ?? null } : null;
    } catch {
      this.cache = null;
    }
    return this.cache;
  }

  async write(session: Session): Promise<void> {
    this.cache = session;
    try {
      await SecureStore.setItemAsync(ACCESS_KEY, session.accessToken);
      if (session.refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken);
      else await SecureStore.deleteItemAsync(REFRESH_KEY);
    } catch {
      // The session still works for this run; it just will not survive a restart.
    }
  }

  async clear(): Promise<void> {
    this.cache = null;
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_KEY),
        SecureStore.deleteItemAsync(REFRESH_KEY),
      ]);
    } catch {
      // Nothing more to do: the in-memory copy is already gone.
    }
  }
}
