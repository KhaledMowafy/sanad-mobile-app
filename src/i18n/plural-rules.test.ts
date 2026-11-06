import { describe, expect, it } from 'vitest';

describe('plural rules without Intl.PluralRules (Hermes)', () => {
  it('still formats the sources line in Arabic and English', async () => {
    const intl = Intl as unknown as { PluralRules?: unknown };
    const original = intl.PluralRules;
    delete intl.PluralRules;
    try {
      const { translate } = await import('./index');
      const arabic = (count: number) => translate('ar', 'chat.message.sourcesCount', { count });
      expect(arabic(1)).toBe('مصدر واحد');
      expect(arabic(2)).toBe('مصدران');
      expect(arabic(4)).toBe('4 مصادر');
      expect(arabic(12)).toBe('12 مصدرًا');
      expect(translate('en', 'chat.message.sourcesCount', { count: 1 })).not.toContain('{');
      expect(typeof Intl.PluralRules).toBe('function');
    } finally {
      intl.PluralRules = original;
    }
  });
});
