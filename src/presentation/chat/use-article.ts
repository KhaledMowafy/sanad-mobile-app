import { useCallback, useEffect, useState } from 'react';
import type { CitationDto } from '@/application/dto/dto';
import { getContainer } from '@/infrastructure/di/container';

export type ArticleState =
  | { status: 'ready'; text: string }
  | { status: 'loading' }
  | { status: 'error' };

/** Article text is public legal text, so one cache for the whole run is safe and saves repeat lookups. */
const cache = new Map<string, string>();
const keyOf = (c: Pick<CitationDto, 'lawName' | 'article'>) => `${c.lawName}|${c.article}`;

type Fetched = { key: string; text: string | null };

/**
 * The text of a cited article. Answers may carry it already, and repeat opens hit the cache;
 * otherwise it is looked up once, on demand, when the reader opens the citation.
 */
export function useArticle(citation: CitationDto | null): {
  state: ArticleState;
  retry: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const [fetched, setFetched] = useState<Fetched | null>(null);

  const key = citation ? keyOf(citation) : null;
  const known = citation?.text ?? (key ? cache.get(key) : undefined) ?? null;

  useEffect(() => {
    if (!citation || !key || known) return;
    let cancelled = false;
    void getContainer()
      .useCases.getArticle.execute({
        lawName: citation.lawName,
        lawNumber: citation.lawNumber,
        lawYear: citation.lawYear,
        article: citation.article,
      })
      .then((result) => {
        if (cancelled) return;
        const text = result.ok && result.value.text ? result.value.text : null;
        if (text) cache.set(key, text);
        setFetched({ key, text });
      })
      .catch(() => {
        if (!cancelled) setFetched({ key, text: null });
      });
    return () => {
      cancelled = true;
    };
    // The citation object changes identity while streaming; its key does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, known, attempt]);

  const retry = useCallback(() => {
    setFetched(null);
    setAttempt((n) => n + 1);
  }, []);

  const state: ArticleState = known
    ? { status: 'ready', text: known }
    : fetched && fetched.key === key
      ? fetched.text
        ? { status: 'ready', text: fetched.text }
        : { status: 'error' }
      : { status: 'loading' };

  return { state, retry };
}
