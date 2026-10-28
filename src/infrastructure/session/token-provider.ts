import type { SessionStore } from '@/application/ports/auth';
import type { TokenProvider } from '../http/api-client';
import { refreshDataSchema } from '../http/api-schemas';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes a base64url string to text. Hermes has no Buffer, and atob is not on every version. */
function decodeBase64Url(input: string): string {
  const clean = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
}

/** Seconds until a JWT expires, read from its payload (not verified; only sizes when to refresh). */
export function secondsUntilExpiry(token: string, nowMs = Date.now()): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
    return typeof json.exp === 'number' ? Math.floor(json.exp - nowMs / 1000) : null;
  } catch {
    return null;
  }
}

/** Renew a little early, so a request that takes a moment does not carry a token that just died. */
const RENEW_WITHIN_SECONDS = 30;

/**
 * Hands the API client its tokens and renews them. The backend rotates the refresh token on every
 * use, so two requests must never refresh at once: they share one call. A refresh that fails ends
 * the session, which is what "sign in again" means.
 */
export class SessionTokens implements TokenProvider {
  private inFlight: Promise<string | null> | null = null;

  constructor(
    private readonly session: SessionStore,
    private readonly apiUrl: string,
    private readonly timeoutMs: number,
    private readonly onExpired: () => void = () => undefined,
  ) {}

  async accessToken(): Promise<string | null> {
    const current = await this.session.read();
    if (!current) return null;
    const left = secondsUntilExpiry(current.accessToken);
    if (left !== null && left <= RENEW_WITHIN_SECONDS && current.refreshToken) {
      return (await this.refresh()) ?? null;
    }
    return current.accessToken;
  }

  refresh(): Promise<string | null> {
    this.inFlight ??= this.renew().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async renew(): Promise<string | null> {
    const current = await this.session.read();
    if (!current?.refreshToken) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh: current.refreshToken }),
        signal: controller.signal,
      });
      if (!response.ok) {
        // A dead refresh token is the end of the session; a 5xx or a timeout is not.
        if (response.status === 401 || response.status === 400) {
          await this.session.clear();
          this.onExpired();
        }
        return null;
      }
      const body = (await response.json()) as { data?: unknown };
      const parsed = refreshDataSchema.safeParse(body.data);
      if (!parsed.success) return null;
      await this.session.write({
        accessToken: parsed.data.access,
        refreshToken: parsed.data.refresh ?? current.refreshToken,
      });
      return parsed.data.access;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
