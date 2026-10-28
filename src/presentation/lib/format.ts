const ZONE = 'Africa/Cairo';

/** "14:32". Western digits always (a product rule), in Egypt's zone so SSR and the browser agree. */
export function formatTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONE,
  }).format(new Date(iso));
}

/** "15 Oct 2026, 14:32" or the Arabic equivalent, with Western digits. */
export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
    timeZone: ZONE,
  }).format(new Date(iso));
}

/** "1 Nov 2026" or the Arabic equivalent, Western digits, in Egypt's zone. */
export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
    dateStyle: 'long',
    timeZone: ZONE,
  }).format(new Date(iso));
}

/** "12,345": Western digits and a comma, whatever the locale. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/** "300 ج.م" or "EGP 300": whole pounds without decimals, Western digits. */
export function formatEgp(piastres: number, locale: string): string {
  const pounds = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(
    piastres / 100,
  );
  return locale === 'ar' ? `${pounds} ج.م` : `EGP ${pounds}`;
}
