/**
 * Server-sent events reader. Yields the payload of each event (its "data:" lines joined with
 * newlines). Handles events split across network chunks, CRLF line endings, comment lines and
 * other fields. Stops and cancels the underlying stream when the consumer stops iterating.
 */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const payloadOf = (rawEvent: string): string | null => {
    const data: string[] = [];
    for (const line of rawEvent.split('\n')) {
      if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    return data.length > 0 ? data.join('\n') : null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n?/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const payload = payloadOf(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (payload !== null) yield payload;
        boundary = buffer.indexOf('\n\n');
      }

      if (done) {
        // A final event without its blank line is still an event.
        const payload = payloadOf(buffer);
        if (payload !== null) yield payload;
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
