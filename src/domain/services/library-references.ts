import type { LibraryReference } from '../entities/library-reference';

/** The kinds a reference can be, as the backend names them. Anything else reads as OTHER. */
export const REFERENCE_KINDS = [
  'CASSATION',
  'COMMENTARY',
  'FORENSIC',
  'PRACTICE',
  'OTHER',
] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

export function referenceKind(reference: Pick<LibraryReference, 'kind'>): ReferenceKind {
  return (REFERENCE_KINDS as readonly string[]).includes(reference.kind)
    ? (reference.kind as ReferenceKind)
    : 'OTHER';
}

/**
 * The rulings and books under an answer, in two lists: what the answer drew on, and what was
 * retrieved for the question without being named in it. Kept apart so a related ruling never
 * reads as support the answer claimed. Binding authority (Cassation) comes first in each list;
 * the backend's order is kept otherwise.
 */
export function groupReferences(references: readonly LibraryReference[]): {
  used: LibraryReference[];
  related: LibraryReference[];
} {
  const ranked = references
    .map((reference, index) => ({ reference, index }))
    .sort((a, b) => b.reference.authority - a.reference.authority || a.index - b.index)
    .map(({ reference }) => reference);
  return {
    used: ranked.filter((r) => r.used),
    related: ranked.filter((r) => !r.used),
  };
}
