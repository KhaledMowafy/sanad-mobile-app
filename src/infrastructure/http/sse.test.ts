import { describe, expect, it } from 'vitest';
import { readSse } from './sse';

function streamOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      const chunk = chunks[i++];
      if (chunk === undefined) controller.close();
      else controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const payload of readSse(body)) out.push(payload);
  return out;
}

describe('readSse', () => {
  it('yields one payload per event', async () => {
    const events = await collect(
      streamOf(['data: {"type":"token","text":"a"}\n\ndata: {"type":"token","text":"b"}\n\n']),
    );
    expect(events).toEqual(['{"type":"token","text":"a"}', '{"type":"token","text":"b"}']);
  });

  it('reassembles events split across chunks', async () => {
    const events = await collect(streamOf(['da', 'ta: {"x":', '1}\n', '\ndata: {"x":2}\n\n']));
    expect(events).toEqual(['{"x":1}', '{"x":2}']);
  });

  it('decodes multi-byte characters split across chunks', async () => {
    const bytes = new TextEncoder().encode('data: {"text":"عقد"}\n\n');
    const events = await collect(streamOf([bytes.slice(0, 18), bytes.slice(18)]));
    expect(events).toEqual(['{"text":"عقد"}']);
  });

  it('accepts CRLF line endings', async () => {
    const events = await collect(streamOf(['data: one\r\n\r\ndata: two\r\n\r\n']));
    expect(events).toEqual(['one', 'two']);
  });

  it('joins multi-line data and ignores comments and other fields', async () => {
    const events = await collect(
      streamOf([': keep-alive\n\nevent: message\nid: 4\ndata: line1\ndata: line2\n\n']),
    );
    expect(events).toEqual(['line1\nline2']);
  });

  it('keeps data without a space after the colon', async () => {
    expect(await collect(streamOf(['data:{"a":1}\n\n']))).toEqual(['{"a":1}']);
  });

  it('flushes a final event that lacks its blank line', async () => {
    expect(await collect(streamOf(['data: last']))).toEqual(['last']);
  });

  it('yields nothing for an empty stream', async () => {
    expect(await collect(streamOf([]))).toEqual([]);
  });

  it('cancels the stream when the consumer stops early', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('data: x\n\n'));
      },
      cancel() {
        cancelled = true;
      },
    });
    const reader = readSse(body);
    await reader.next();
    await reader.return(undefined);
    expect(cancelled).toBe(true);
  });
});
