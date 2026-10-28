import { create } from 'zustand';
import type { ConversationGroupDto } from '@/application/dto/dto';
import { getContainer } from '@/infrastructure/di/container';

interface ConversationsState {
  groups: ConversationGroupDto[];
  query: string;
  loading: boolean;
  failed: boolean;
  /** Reloads the history, keeping the current search. */
  refresh: () => Promise<void>;
  setQuery: (query: string) => void;
  rename: (id: string, title: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export const useConversations = create<ConversationsState>((set, get) => {
  let latest = 0;

  const load = async () => {
    // Only the newest request may answer: typing quickly must not show an older search.
    const mine = ++latest;
    set({ loading: true });
    const { query } = get();
    const result = await getContainer().useCases.searchConversations.execute(query);
    if (mine !== latest) return;
    set(
      result.ok
        ? { groups: result.value, loading: false, failed: false }
        : { loading: false, failed: true },
    );
  };

  return {
    groups: [],
    query: '',
    loading: false,
    failed: false,
    refresh: load,

    setQuery: (query) => {
      set({ query });
      void load();
    },

    rename: async (id, title) => {
      const result = await getContainer().useCases.renameConversation.execute({ id, title });
      if (result.ok) await load();
      return result.ok;
    },

    remove: async (id) => {
      const result = await getContainer().useCases.deleteConversation.execute(id);
      if (result.ok) await load();
      return result.ok;
    },
  };
});
