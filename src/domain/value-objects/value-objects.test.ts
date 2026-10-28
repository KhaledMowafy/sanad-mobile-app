import { describe, expect, it } from 'vitest';
import {
  InvalidArticleReferenceError,
  InvalidBarNumberError,
  InvalidConversationTitleError,
  InvalidEmailError,
  InvalidPasswordError,
  InvalidPhoneNumberError,
  InvalidVerificationCodeError,
} from '../errors/domain-error';
import { ArticleReference } from './article-reference';
import { BarRegistrationNumber } from './bar-registration-number';
import { CONVERSATION_TITLE_MAX, ConversationTitle } from './conversation-title';
import { toWesternDigits } from './digits';
import { EgyptianPhoneNumber } from './egyptian-phone-number';
import { Email } from './email';
import { toggleFeedback } from './feedback';
import { directionOf, isLocale, parseLocale } from './locale';
import { Password, passwordStrength } from './password';
import { VerificationCode } from './verification-code';

describe('locale', () => {
  it('recognises supported locales only', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('falls back to Arabic', () => {
    expect(parseLocale('en')).toBe('en');
    expect(parseLocale('de')).toBe('ar');
    expect(parseLocale('de', 'en')).toBe('en');
  });

  it('maps direction', () => {
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
  });
});

describe('toWesternDigits', () => {
  it('converts Arabic-Indic and Persian digits', () => {
    expect(toWesternDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toWesternDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(toWesternDigits('م. ١٤٧ abc')).toBe('م. 147 abc');
  });
});

describe('Email', () => {
  it('trims and lowercases', () => {
    expect(Email.create('  Mona@Example.COM ').value).toBe('mona@example.com');
  });

  it('rejects malformed addresses', () => {
    for (const bad of ['', 'no-at', 'a@b', 'a b@c.com']) {
      expect(() => Email.create(bad)).toThrow(InvalidEmailError);
    }
  });

  it('compares by value', () => {
    expect(Email.create('a@b.co').equals(Email.create('A@B.CO'))).toBe(true);
    expect(Email.create('a@b.co').equals(Email.create('c@b.co'))).toBe(false);
  });
});

describe('EgyptianPhoneNumber', () => {
  it.each([
    '01012345678',
    '1012345678',
    '+201012345678',
    '00201012345678',
    '201012345678',
    '+20 10 1234 5678',
    '٠١٠١٢٣٤٥٦٧٨',
    '010-1234-5678',
  ])('normalises %s', (raw) => {
    const phone = EgyptianPhoneNumber.create(raw);
    expect(phone.national).toBe('1012345678');
    expect(phone.e164).toBe('+201012345678');
  });

  it('accepts all Egyptian mobile prefixes', () => {
    for (const prefix of ['10', '11', '12', '15']) {
      expect(() => EgyptianPhoneNumber.create(`${prefix}12345678`)).not.toThrow();
    }
  });

  it.each(['', '123', '01312345678', '0101234567', '010123456789', 'abc'])('rejects %s', (raw) => {
    expect(() => EgyptianPhoneNumber.create(raw)).toThrow(InvalidPhoneNumberError);
  });
});

describe('BarRegistrationNumber', () => {
  it('accepts digits including Arabic-Indic', () => {
    expect(BarRegistrationNumber.create(' ١٢٣٤٥ ').value).toBe('12345');
  });

  it('rejects non-digits and overlong values', () => {
    expect(() => BarRegistrationNumber.create('12a')).toThrow(InvalidBarNumberError);
    expect(() => BarRegistrationNumber.create('12345678901')).toThrow(InvalidBarNumberError);
    expect(() => BarRegistrationNumber.create('')).toThrow(InvalidBarNumberError);
  });
});

describe('Password', () => {
  it('needs 8 characters, an uppercase letter and a special character', () => {
    expect(Password.create('Sanadak2026!').value).toBe('Sanadak2026!');
    expect(() => Password.create('Ab1!')).toThrowError(
      expect.objectContaining({ code: 'password_too_short' }),
    );
    expect(() => Password.create('sanadak2026!')).toThrowError(
      expect.objectContaining({ code: 'password_needs_uppercase' }),
    );
    expect(() => Password.create('Sanadak2026')).toThrowError(
      expect.objectContaining({ code: 'password_needs_special' }),
    );
    expect(() => Password.create('short1')).toThrow(InvalidPasswordError);
  });

  it('does not require a digit, because the backend does not report that rule', () => {
    expect(() => Password.create('Sanadak!!')).not.toThrow();
  });

  it('scores strength from 0 to 4', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(0);
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('abcdefg1')).toBe(2);
    expect(passwordStrength('Sanadak2026')).toBe(3);
    expect(passwordStrength('Sanadak2026!')).toBe(4);
  });
});

describe('VerificationCode', () => {
  it('accepts six digits, ignoring spaces, dashes and Arabic-Indic digits', () => {
    expect(VerificationCode.create('123456').value).toBe('123456');
    expect(VerificationCode.create(' 123-456 ').value).toBe('123456');
    expect(VerificationCode.create('١٢٣٤٥٦').value).toBe('123456');
  });

  it('rejects anything else', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 5a']) {
      expect(() => VerificationCode.create(bad)).toThrow(InvalidVerificationCodeError);
    }
  });
});

describe('ConversationTitle', () => {
  it('collapses whitespace', () => {
    expect(ConversationTitle.create('  فسخ   عقد \n شقة ').value).toBe('فسخ عقد شقة');
  });

  it('rejects empty and overlong titles', () => {
    expect(() => ConversationTitle.create('   ')).toThrow(InvalidConversationTitleError);
    expect(() => ConversationTitle.create('x'.repeat(CONVERSATION_TITLE_MAX + 1))).toThrow(
      InvalidConversationTitleError,
    );
    expect(ConversationTitle.create('x'.repeat(CONVERSATION_TITLE_MAX)).value).toHaveLength(
      CONVERSATION_TITLE_MAX,
    );
  });

  it('derives a short title from the first message', () => {
    expect(ConversationTitle.fromFirstMessage('سؤال قصير').value).toBe('سؤال قصير');
  });

  it('cuts long messages at a word boundary', () => {
    const long =
      'موكلي اشترى شقة من شركة تطوير عقاري بعقد ابتدائي ودفع مقدما مبلغا كبيرا ولم تسلم الشقة';
    const title = ConversationTitle.fromFirstMessage(long).value;
    expect(title.length).toBeLessThanOrEqual(60);
    expect(long.startsWith(title)).toBe(true);
    expect(long[title.length]).toBe(' ');
  });

  it('hard cuts when there is no usable word boundary', () => {
    const title = ConversationTitle.fromFirstMessage('x'.repeat(200)).value;
    expect(title).toHaveLength(60);
  });
});

describe('ArticleReference', () => {
  const law = { name: ' القانون المدني ', number: 131, year: 1948 };

  it('normalises name and digits', () => {
    const ref = ArticleReference.create(law, ' ١٤٧  مكرر ');
    expect(ref.law.name).toBe('القانون المدني');
    expect(ref.article).toBe('147 مكرر');
  });

  it('labels per locale', () => {
    const ref = ArticleReference.create(law, '147');
    expect(ref.label('ar')).toBe('م. 147');
    expect(ref.label('en')).toBe('Art. 147');
  });

  it('compares by key', () => {
    const a = ArticleReference.create(law, '147');
    const b = ArticleReference.create({ name: 'القانون المدني', number: 131, year: 1948 }, '١٤٧');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(ArticleReference.create(law, '148'))).toBe(false);
    expect(a.key).toBe('القانون المدني|131|1948|147');
  });

  it('keeps unknown number and year out of the key', () => {
    const ref = ArticleReference.create({ name: 'قانون', number: null, year: null }, '1');
    expect(ref.key).toBe('قانون|||1');
  });

  it('requires a law and an article', () => {
    expect(() => ArticleReference.create({ name: ' ', number: null, year: null }, '1')).toThrow(
      InvalidArticleReferenceError,
    );
    expect(() => ArticleReference.create(law, '  ')).toThrow(InvalidArticleReferenceError);
  });
});

describe('toggleFeedback', () => {
  it('sets, switches and clears', () => {
    expect(toggleFeedback(null, 'up')).toBe('up');
    expect(toggleFeedback('up', 'down')).toBe('down');
    expect(toggleFeedback('up', 'up')).toBeNull();
  });
});
