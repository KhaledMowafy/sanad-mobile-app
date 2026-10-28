/**
 * A ruling or a book the answer drew on, beside the statute articles. `used` is false when it was
 * only retrieved for the case and offered to the model: related, not relied on.
 */
export interface LibraryReference {
  readonly id: string;
  readonly used: boolean;
  /** CASSATION, COMMENTARY, FORENSIC, PRACTICE or OTHER. */
  readonly kind: string;
  /** 30 binding (Cassation), 20 persuasive, 10 informative. */
  readonly authority: number;
  /** Ready-made display text. */
  readonly label: string;
  readonly title: string;
  readonly author: string;
  readonly page: number | null;
  readonly appealNumber: number | null;
  readonly appealYear: number | null;
  readonly citable: boolean | null;
}
