/**
 * Hermes has no Intl.PluralRules, and the message formatter needs it to pick "one", "two", "few"
 * and so on. Without it an answer's "N sources" line showed its raw template. This fills the gap
 * for the two languages the app has, with the standard CLDR rules.
 */
type Category = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

function select(locale: string, n: number): Category {
  const value = Math.abs(n);
  if (locale.startsWith('ar')) {
    if (value === 0) return 'zero';
    if (value === 1) return 'one';
    if (value === 2) return 'two';
    const last = value % 100;
    if (Number.isInteger(value) && last >= 3 && last <= 10) return 'few';
    if (Number.isInteger(value) && last >= 11 && last <= 99) return 'many';
    return 'other';
  }
  return value === 1 ? 'one' : 'other';
}

export function installPluralRules(): void {
  const intl = Intl as unknown as { PluralRules?: unknown };
  if (typeof intl.PluralRules === 'function') return;

  class PluralRulesShim {
    private readonly locale: string;
    constructor(locales?: string | string[]) {
      this.locale = (Array.isArray(locales) ? locales[0] : locales) ?? 'en';
    }
    select(n: number): Category {
      return select(this.locale, n);
    }
    resolvedOptions() {
      return { locale: this.locale };
    }
    static supportedLocalesOf(locales: string | string[]): string[] {
      return Array.isArray(locales) ? locales : [locales];
    }
  }

  intl.PluralRules = PluralRulesShim;
}
