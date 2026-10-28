import { create } from 'zustand';
import { DEFAULT_LIMITS, type UsageLimits } from '@/domain/entities/limits';
import { getContainer } from '@/infrastructure/di/container';

interface LimitsState {
  limits: UsageLimits;
  /** Reads the limits the server states; the defaults stand in until then or if it cannot be read. */
  load: () => Promise<void>;
}

export const useLimits = create<LimitsState>((set) => ({
  limits: DEFAULT_LIMITS,
  load: async () => {
    const result = await getContainer().useCases.getLimits.execute();
    if (result.ok) set({ limits: result.value });
  },
}));
