import { describe, expect, it } from 'vitest';
import type { LibraryReference } from '../entities/library-reference';
import { groupReferences, referenceKind } from './library-references';

function reference(overrides: Partial<LibraryReference>): LibraryReference {
  return {
    id: 'r',
    used: true,
    kind: 'COMMENTARY',
    authority: 20,
    label: 'شرح',
    title: 'شرح',
    author: '',
    page: 1,
    appealNumber: null,
    appealYear: null,
    citable: null,
    ...overrides,
  };
}

describe('groupReferences', () => {
  it('keeps what the answer drew on apart from what was only retrieved', () => {
    const { used, related } = groupReferences([
      reference({ id: 'a', used: true }),
      reference({ id: 'b', used: false }),
    ]);
    expect(used.map((r) => r.id)).toEqual(['a']);
    expect(related.map((r) => r.id)).toEqual(['b']);
  });

  it('puts a Cassation ruling first, and keeps the order otherwise', () => {
    const { used } = groupReferences([
      reference({ id: 'book-1', authority: 20 }),
      reference({ id: 'book-2', authority: 20 }),
      reference({ id: 'ruling', kind: 'CASSATION', authority: 30 }),
    ]);
    expect(used.map((r) => r.id)).toEqual(['ruling', 'book-1', 'book-2']);
  });

  it('is empty for none', () => {
    expect(groupReferences([])).toEqual({ used: [], related: [] });
  });
});

describe('referenceKind', () => {
  it('reads an unknown kind as OTHER', () => {
    expect(referenceKind({ kind: 'CASSATION' })).toBe('CASSATION');
    expect(referenceKind({ kind: 'SOMETHING' })).toBe('OTHER');
  });
});
