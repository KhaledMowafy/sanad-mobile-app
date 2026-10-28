import { useCallback, useMemo } from 'react';
import { usePrefs } from '@/stores/prefs-store';
import { hasMessage, rawMessage, translate, type Values } from './index';

export interface Translator {
  (key: string, values?: Values): string;
  /** Whether the key exists, for messages chosen by a code the server sent. */
  has: (key: string) => boolean;
  /** The array or object at a key (features, steps, FAQ items). */
  raw: <T>(key: string) => T;
}

/** Translations for one section of the catalogue, in the language chosen in the app. */
export function useT(namespace?: string): Translator {
  const locale = usePrefs((s) => s.locale);
  const full = useCallback((key: string) => (namespace ? `${namespace}.${key}` : key), [namespace]);

  return useMemo(() => {
    return Object.assign((key: string, values?: Values) => translate(locale, full(key), values), {
      has: (key: string) => hasMessage(locale, full(key)),
      raw: <T,>(key: string) => rawMessage<T>(locale, full(key)),
    }) as Translator;
  }, [locale, full]);
}
