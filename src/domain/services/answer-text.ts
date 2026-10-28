const SOURCES_HEADING = /^\s*(?:المصادر|Sources)\s*:\s*$/;
const LIST_ITEM = /^\s*(?:[•\-*]|\d+[.)])\s+\S/;
/** The footer blocks that list rulings and books. The UI keeps only the sources. */
const REFERENCE_HEADING = /^\s*(?:[*#]+\s*)?(?:المراجع|مراجع ذات صلة)\s*:?\s*(?:\*+)?\s*:?\s*$/;
const RULE = /^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/;

/**
 * Answers end with a plain-text "المصادر:" list that repeats the structured citations. When
 * those citations exist the list is redundant, so it is removed from what is rendered.
 * Only a trailing block made purely of list items is cut; anything else is left alone.
 */
export function withoutSourcesBlock(content: string, hasStructuredCitations: boolean): string {
  if (!hasStructuredCitations) return content;

  const lines = content.split('\n');
  let heading = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (SOURCES_HEADING.test(lines[i] ?? '')) {
      heading = i;
      break;
    }
  }
  if (heading === -1) return content;

  const tail = lines.slice(heading + 1);
  const onlyListItems = tail.every((line) => line.trim() === '' || LIST_ITEM.test(line));
  if (!onlyListItems) return content;

  let end = heading;
  // Drop a horizontal rule and blank lines that introduced the block.
  while (end > 0 && (lines[end - 1]?.trim() === '' || RULE.test(lines[end - 1] ?? ''))) end--;
  return lines.slice(0, end).join('\n').trimEnd();
}

/**
 * Removes the "المراجع:" and "مراجع ذات صلة:" blocks the backend appends after the sources: the
 * heading and the list items under it, up to the next paragraph that is not a list.
 */
export function withoutReferenceBlocks(content: string): string {
  const lines = content.split('\n');
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!REFERENCE_HEADING.test(line)) {
      kept.push(line);
      continue;
    }
    // Skip the list under the heading, and the blank lines inside it.
    while (i + 1 < lines.length) {
      const next = lines[i + 1] ?? '';
      if (next.trim() === '' || LIST_ITEM.test(next)) i++;
      else break;
    }
  }
  return kept.join('\n').trimEnd();
}
