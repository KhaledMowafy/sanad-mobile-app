import { InvalidArticleReferenceError } from '../errors/domain-error';
import { toWesternDigits } from './digits';
import type { Locale } from './locale';

export interface LawReference {
  /** Display name, e.g. "القانون المدني" */
  readonly name: string;
  readonly number: number | null;
  readonly year: number | null;
}

export class ArticleReference {
  private constructor(
    readonly law: LawReference,
    /** A string, because articles carry suffixes such as "147 مكرر" */
    readonly article: string,
  ) {}

  static create(law: LawReference, article: string): ArticleReference {
    const name = law.name.trim();
    const normalised = toWesternDigits(article).replace(/\s+/g, ' ').trim();
    if (name.length === 0) throw new InvalidArticleReferenceError('Law name is required');
    if (normalised.length === 0) throw new InvalidArticleReferenceError('Article is required');
    return new ArticleReference({ ...law, name }, normalised);
  }

  /** Short chip label: "م. 147" in Arabic, "Art. 147" in English. */
  label(locale: Locale): string {
    return locale === 'ar' ? `م. ${this.article}` : `Art. ${this.article}`;
  }

  get key(): string {
    return `${this.law.name}|${this.law.number ?? ''}|${this.law.year ?? ''}|${this.article}`;
  }

  equals(other: ArticleReference): boolean {
    return this.key === other.key;
  }
}
