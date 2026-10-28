import { z } from 'zod';
import { isUsageLimitName } from '@/domain/entities/usage';
import { toUsageSnapshot } from './usage-mappers';
import type { AppError } from '@/application/errors';
import { err, ok, type Result } from '@/application/result';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface TokenProvider {
  accessToken(): Promise<string | null>;
  /** A fresh access token, or null when refreshing is not possible. */
  refresh(): Promise<string | null>;
}

/** Hermes has no AbortSignal.timeout or AbortSignal.any, so both are built from AbortController. */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error('timeout')), ms);
  return controller.signal;
}

function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export interface ApiClientOptions {
  /** e.g. http://41.187.93.60:34000/api, no trailing slash */
  readonly baseUrl: string;
  readonly timeoutMs: number;
  /**
   * How long to wait for an answer stream to open. A defence memo plans, retrieves and audits
   * before its first token, far longer than an ordinary request.
   */
  readonly streamTimeoutMs?: number;
  readonly tokens?: TokenProvider;
  readonly fetch?: typeof fetch;
}

export interface RequestOptions<T> {
  readonly method?: HttpMethod;
  /** Path under baseUrl, starting with "/". */
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | undefined>>;
  readonly body?: unknown;
  /** Validates the envelope's "data". */
  readonly schema: z.ZodType<T>;
  /** Defaults to true. Login and register are unauthenticated. */
  readonly auth?: boolean;
  readonly signal?: AbortSignal;
}

export interface Page<T> {
  readonly items: T[];
  readonly next: string | null;
  readonly previous: string | null;
  readonly totalPages: number | null;
}

/** Every sanadtech response is wrapped as {status_code, status, message, data}. */
const envelopeSchema = z.looseObject({
  message: z.string().nullish(),
  data: z.unknown().optional(),
  total_page_count: z.number().nullish(),
  next: z.string().nullish(),
  previous: z.string().nullish(),
});
type Envelope = z.infer<typeof envelopeSchema>;

interface Attempt {
  readonly result: Result<Envelope, AppError>;
  /** Worth retrying for idempotent requests. */
  readonly transient: boolean;
}

function validationFields(data: unknown): Record<string, string> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const keys = Object.keys(data);
    if (keys.length > 0) return Object.fromEntries(keys.map((key) => [key, 'invalid']));
  }
  return { _form: 'invalid' };
}

/** Messages per field when the backend sends {field: ["reason", ...]}. */
function validationDetails(data: unknown): Record<string, string[]> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const details: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(data)) {
    const messages = (Array.isArray(value) ? value : [value]).filter(
      (item): item is string => typeof item === 'string',
    );
    if (messages.length > 0) details[key] = messages;
  }
  return Object.keys(details).length > 0 ? details : null;
}

/**
 * Login and every verified-only route say why they are forbidden in the message. The client
 * asks for English, so the sentences are stable enough to route on.
 */
export function forbiddenReason(message: string | null): AppError {
  const text = message ?? '';
  if (/not verified|verify your email/i.test(text)) {
    return { kind: 'forbidden', code: 'email_not_verified' };
  }
  if (/inactive/i.test(text)) return { kind: 'forbidden', code: 'account_inactive' };
  if (/locked/i.test(text)) {
    const minutes = Number(/(\d+)\s*minute/i.exec(text)?.[1]);
    return {
      kind: 'forbidden',
      code: 'account_locked',
      ...(Number.isFinite(minutes) ? { minutes } : {}),
    };
  }
  return { kind: 'forbidden' };
}

function errorForStatus(status: number, envelope: Envelope | null): AppError {
  const message = envelope?.message ?? null;
  switch (status) {
    case 400:
    case 422:
      const details = validationDetails(envelope?.data);
      return {
        kind: 'validation',
        fields: validationFields(envelope?.data),
        ...(details ? { details } : {}),
      };
    case 401:
      return { kind: 'unauthenticated' };
    case 403:
      return forbiddenReason(message);
    case 404:
      return { kind: 'not_found' };
    case 409:
      return { kind: 'conflict', code: 'conflict' };
    case 429: {
      // A spent usage limit names itself in data.limit. The request throttle sends no data.
      const data = envelope?.data;
      const limit =
        data && typeof data === 'object' ? (data as Record<string, unknown>).limit : null;
      if (isUsageLimitName(limit)) {
        return {
          kind: 'quota',
          limit,
          usage: toUsageSnapshot((data as Record<string, unknown>).usage),
        };
      }
      return { kind: 'rate_limited' };
    }
    default:
      return { kind: 'unknown', message };
  }
}

/** Server side only: the browser sees a stable code, the operator needs to know what failed. */
function logUnexpected(method: string, path: string, status: number, body: string): void {
  if (status < 500 && status !== 400) return;
  console.error(`[api] ${method} ${path} -> ${status} ${body.slice(0, 300)}`);
}

function parseEnvelope(text: string): Envelope | null {
  if (text.length === 0) return null;
  try {
    const parsed = envelopeSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface StreamRequest {
  readonly method?: 'GET' | 'POST';
  readonly path: string;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async request<T>(req: RequestOptions<T>): Promise<Result<T, AppError>> {
    const envelope = await this.exchange(req);
    if (!envelope.ok) return envelope;
    const parsed = req.schema.safeParse(envelope.value.data);
    if (!parsed.success) {
      const paths = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`);
      console.error(`[api] ${req.path} reply does not match the schema`, paths);
      return err({ kind: 'unknown', message: `Unexpected response shape for ${req.path}` });
    }
    return ok(parsed.data);
  }

  /** For list endpoints that carry total_page_count, next and previous beside "data". */
  async requestPage<T>(req: RequestOptions<T>): Promise<Result<Page<T>, AppError>> {
    const items = z.array(req.schema);
    const envelope = await this.exchange({ ...req, schema: items as unknown as z.ZodType<T> });
    if (!envelope.ok) return envelope;
    const parsed = items.safeParse(envelope.value.data);
    if (!parsed.success) {
      return err({ kind: 'unknown', message: `Unexpected response shape for ${req.path}` });
    }
    return ok({
      items: parsed.data,
      next: envelope.value.next ?? null,
      previous: envelope.value.previous ?? null,
      totalPages: envelope.value.total_page_count ?? null,
    });
  }

  /**
   * Opens a text/event-stream response. The timeout covers connecting only; once headers arrive
   * the caller's signal is the only way to stop it. Failures before the stream opens come back
   * as ordinary enveloped JSON and are mapped like any other request.
   */
  async openStream(req: StreamRequest): Promise<Result<Response, AppError>> {
    const token = (await this.options.tokens?.accessToken()) ?? null;
    const headers: Record<string, string> = {
      // DRF answers 406 to an Accept it has no renderer for, and the view only has JSON ones.
      // The stream is recognised by the response Content-Type, so the wildcard is what gets in.
      Accept: 'text/event-stream, application/json;q=0.9, */*;q=0.8',
      'Accept-Language': 'en',
    };
    if (req.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const connect = new AbortController();
    const timer = setTimeout(
      () => connect.abort(),
      this.options.streamTimeoutMs ?? this.options.timeoutMs,
    );
    const signal = req.signal ? anySignal([req.signal, connect.signal]) : connect.signal;

    let response: Response;
    try {
      response = await this.fetchImpl(new URL(`${this.options.baseUrl}${req.path}`), {
        method: req.method ?? 'POST',
        headers,
        body: req.body === undefined ? null : JSON.stringify(req.body),
        signal,
        cache: 'no-store',
      });
    } catch {
      return err({ kind: 'network' });
    } finally {
      clearTimeout(timer);
    }

    const isStream = response.headers.get('content-type')?.includes('text/event-stream') ?? false;
    if (response.ok && isStream && response.body) return ok(response);

    const text = await response.text();
    const envelope = parseEnvelope(text);
    if (!response.ok) {
      logUnexpected(req.method ?? 'POST', req.path, response.status, text);
      return err(errorForStatus(response.status, envelope));
    }
    return err({ kind: 'unknown', message: 'Expected an event stream' });
  }

  /** A file response (not enveloped), such as a finished defence memo. */
  async requestBinary(req: {
    readonly path: string;
    readonly signal?: AbortSignal;
  }): Promise<
    Result<{ bytes: Uint8Array; contentType: string; filename: string | null }, AppError>
  > {
    const token = (await this.options.tokens?.accessToken()) ?? null;
    const headers: Record<string, string> = { Accept: '*/*', 'Accept-Language': 'en' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const timeout = timeoutSignal(this.options.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(`${this.options.baseUrl}${req.path}`), {
        headers,
        signal: req.signal ? anySignal([req.signal, timeout]) : timeout,
        cache: 'no-store',
      });
    } catch {
      return err({ kind: 'network' });
    }

    if (!response.ok) {
      const text = await response.text();
      logUnexpected('GET', req.path, response.status, text);
      return err(errorForStatus(response.status, parseEnvelope(text)));
    }
    const disposition = response.headers.get('content-disposition') ?? '';
    const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? null;
    return ok({
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      filename,
    });
  }

  private async exchange<T>(req: RequestOptions<T>): Promise<Result<Envelope, AppError>> {
    const idempotent = (req.method ?? 'GET') === 'GET';
    const tries = idempotent ? 2 : 1;
    let token = req.auth === false ? null : ((await this.options.tokens?.accessToken()) ?? null);
    let refreshed = false;
    let last: Attempt | undefined;

    for (let i = 0; i < tries; i++) {
      last = await this.attempt(req, token);
      const error = last.result.ok ? null : last.result.error;

      if (error?.kind === 'unauthenticated' && req.auth !== false && !refreshed) {
        refreshed = true;
        const fresh = await this.options.tokens?.refresh();
        if (!fresh) return last.result;
        token = fresh;
        i--; // the refresh retry does not use up a transient-retry slot
        continue;
      }
      if (!last.transient) return last.result;
    }
    return last!.result;
  }

  private async attempt<T>(req: RequestOptions<T>, token: string | null): Promise<Attempt> {
    const url = new URL(`${this.options.baseUrl}${req.path}`);
    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    // The backend localises its validation messages; English is the one we can map to codes.
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Language': 'en',
    };
    // FormData sets its own multipart boundary, so no Content-Type is declared for it.
    const multipart = req.body instanceof FormData;
    if (req.body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const timeout = timeoutSignal(this.options.timeoutMs);
    const signal = req.signal ? anySignal([req.signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: req.method ?? 'GET',
        headers,
        body:
          req.body === undefined
            ? null
            : multipart
              ? (req.body as FormData)
              : JSON.stringify(req.body),
        signal,
        cache: 'no-store',
      });
    } catch {
      // Aborted by the caller is not worth retrying; a timeout or socket error is.
      return { result: err({ kind: 'network' }), transient: !req.signal?.aborted };
    }

    const text = await response.text();
    const envelope = parseEnvelope(text);

    if (!response.ok) {
      logUnexpected(req.method ?? 'GET', req.path, response.status, text);
      return {
        result: err(errorForStatus(response.status, envelope)),
        transient: response.status >= 500,
      };
    }
    // An empty success body (DELETE, logout) is fine.
    return { result: ok(envelope ?? { data: undefined }), transient: false };
  }
}
