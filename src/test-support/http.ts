export interface Recorded {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  /** Set for multipart requests. */
  form: FormData | null;
}

type Responder = (call: Recorded) => Response | Promise<Response>;

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function envelope(data: unknown, extra: Record<string, unknown> = {}) {
  return { status_code: 200, status: 0, message: 'ok', data, ...extra };
}

/** A fetch stand-in that records requests and answers from the supplied queue or function. */
export function fakeFetch(responses: Response[] | Responder) {
  const calls: Recorded[] = [];
  const queue = Array.isArray(responses) ? [...responses] : null;
  const impl = (async (input: URL | string, init?: RequestInit) => {
    const call: Recorded = {
      url: new URL(String(input)),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      form: init?.body instanceof FormData ? init.body : null,
    };
    calls.push(call);
    if (queue) {
      const next = queue.shift();
      if (!next) throw new Error('fakeFetch: no response queued');
      return next;
    }
    return (responses as Responder)(call);
  }) as typeof fetch;
  return { fetch: impl, calls };
}
