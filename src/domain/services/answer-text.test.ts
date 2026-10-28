import { describe, expect, it } from 'vitest';
import { withoutReferenceBlocks, withoutSourcesBlock } from './answer-text';

describe('withoutSourcesBlock', () => {
  const answer = 'المادة 85 تنص على كذا.';

  it('removes a trailing sources list when structured citations exist', () => {
    const content = `${answer}\n\n---\nالمصادر:\n• 280_قانون المحاماه، المادة 85\n• قانون 182 لسنة 2018، المادة 85\n`;
    expect(withoutSourcesBlock(content, true)).toBe(answer);
  });

  it('keeps the list when there are no structured citations to replace it', () => {
    const content = `${answer}\n\n---\nالمصادر:\n• 280_قانون المحاماه، المادة 85\n`;
    expect(withoutSourcesBlock(content, false)).toBe(content);
  });

  it('handles the English heading and numbered items', () => {
    const content = `${answer}\n\nSources:\n1. Civil Code, Art. 157\n2) Civil Code, Art. 158`;
    expect(withoutSourcesBlock(content, true)).toBe(answer);
  });

  it('works without the horizontal rule', () => {
    expect(withoutSourcesBlock(`${answer}\nالمصادر:\n- مادة`, true)).toBe(answer);
  });

  it('leaves a heading that is followed by prose', () => {
    const content = `${answer}\n\nالمصادر:\nهذه المصادر مذكورة في النص أعلاه.`;
    expect(withoutSourcesBlock(content, true)).toBe(content);
  });

  it('leaves content without any sources heading unchanged', () => {
    expect(withoutSourcesBlock(answer, true)).toBe(answer);
  });

  it('only cuts the last block, not an earlier mention', () => {
    const content = `المصادر:\n• أولى\n\nنص بعد ذلك\n\nالمصادر:\n• ثانية`;
    expect(withoutSourcesBlock(content, true)).toBe('المصادر:\n• أولى\n\nنص بعد ذلك');
  });

  it('keeps bullet lists that are part of the answer body', () => {
    const content = `الخطوات:\n- الأولى\n- الثانية\n\nالمصادر:\n• مادة`;
    expect(withoutSourcesBlock(content, true)).toBe('الخطوات:\n- الأولى\n- الثانية');
  });
});

describe('withoutReferenceBlocks', () => {
  const answer = 'الإجابة هنا.';

  it('removes the references and related-references blocks and keeps the sources', () => {
    const text = [
      answer,
      '',
      'المصادر:',
      '- القانون المدني، المادة 147',
      '',
      'المراجع:',
      '- السنهوري، الوسيط، ص 905 — رأي فقهي',
      '',
      'مراجع ذات صلة:',
      '- أحمد فتحي سرور، ص 77 — رأي فقهي',
    ].join('\n');
    expect(withoutReferenceBlocks(text)).toBe(
      [answer, '', 'المصادر:', '- القانون المدني، المادة 147'].join('\n'),
    );
  });

  it('then lets the sources block go too when structured citations exist', () => {
    const text = `${answer}

المصادر:
- المادة 147

المراجع:
- كتاب`;
    expect(withoutSourcesBlock(withoutReferenceBlocks(text), true)).toBe(answer);
  });

  it('leaves an answer without those headings alone, and ordinary text after a block', () => {
    expect(withoutReferenceBlocks(answer)).toBe(answer);
    const text = `${answer}

المراجع:
- كتاب

خلاصة أخيرة.`;
    expect(withoutReferenceBlocks(text)).toBe(`${answer}

خلاصة أخيرة.`);
  });
});
