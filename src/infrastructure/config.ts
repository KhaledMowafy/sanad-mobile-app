/**
 * Where the app talks to. Set EXPO_PUBLIC_API_URL when building (it is inlined into the bundle);
 * the default is the same backend the website uses.
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://41.187.93.60:34000/api'
).replace(/\/+$/, '');

/** Ordinary requests give up after this; an answer stream waits much longer for its first byte. */
export const REQUEST_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT_MS ?? 15_000);
export const STREAM_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_STREAM_TIMEOUT_MS ?? 180_000);

/** The website, for legal pages and anything the app hands back to the browser. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'http://41.187.93.60:34777').replace(
  /\/+$/,
  '',
);
