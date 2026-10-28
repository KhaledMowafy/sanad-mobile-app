import { create } from 'zustand';
import type { UserDto } from '@/application/dto/dto';
import { getContainer, onSessionExpired } from '@/infrastructure/di/container';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'unavailable';

interface AuthState {
  status: AuthStatus;
  user: UserDto | null;
  /** Reads the saved session and asks the backend who it belongs to. */
  bootstrap: () => Promise<void>;
  setUser: (user: UserDto) => void;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => {
  // A refresh token the backend refuses ends the session wherever the person is.
  onSessionExpired(() => set({ status: 'signedOut', user: null }));

  return {
    status: 'loading',
    user: null,

    bootstrap: async () => {
      const result = await getContainer().useCases.getCurrentUser.execute();
      if (!result.ok) {
        // An outage is not a logout: say so instead of bouncing to sign in.
        set({ status: 'unavailable', user: null });
        return;
      }
      set(result.value ? { status: 'signedIn', user: result.value } : { status: 'signedOut', user: null });
    },

    setUser: (user) => set({ status: 'signedIn', user }),

    signOut: async () => {
      await getContainer().useCases.signOut.execute();
      set({ status: 'signedOut', user: null });
    },
  };
});
