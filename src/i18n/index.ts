import { IntlMessageFormat } from 'intl-messageformat';
import ar from './messages/ar.json';
import en from './messages/en.json';

export type Locale = 'ar' | 'en';

export const LOCALES: readonly Locale[] = ['ar', 'en'];
export const DEFAULT_LOCALE: Locale = 'ar';

const catalogues: Record<Locale, unknown> = { ar, en };

function lookup(locale: Locale, path: string): unknown {
  let node: unknown = catalogues[locale];
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

const formatters = new Map<string, IntlMessageFormat>();

function formatterFor(locale: Locale, path: string, message: string): IntlMessageFormat {
  const key = `${locale}:${path}`;
  let found = formatters.get(key);
  if (!found) {
    found = new IntlMessageFormat(message, locale);
    formatters.set(key, found);
  }
  return found;
}

export type Values = Record<string, string | number>;

/** A message with its placeholders filled. A missing key shows its path, never a blank. */
export function translate(locale: Locale, path: string, values?: Values): string {
  const message = lookup(locale, path);
  if (typeof message !== 'string') return path;
  // The website's rich tags (<n>1948</n>) only style a number; here they are plain text.
  const withoutTags = message.replace(/<\/?[a-z]+>/g, '');
  if (!values && !/[{]/.test(withoutTags)) return withoutTags;
  try {
    const out = formatterFor(locale, path, withoutTags).format(values);
    return Array.isArray(out) ? out.join('') : String(out);
  } catch {
    return withoutTags;
  }
}

export function hasMessage(locale: Locale, path: string): boolean {
  return typeof lookup(locale, path) === 'string';
}

/** The raw value at a path: the arrays of features, steps and FAQ items. */
export function rawMessage<T>(locale: Locale, path: string): T {
  return lookup(locale, path) as T;
}

export const isRtl = (locale: Locale): boolean => locale === 'ar';
