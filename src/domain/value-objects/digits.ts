const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** Product rule: Western digits everywhere. Normalise Arabic-Indic and Persian digits on input. */
export function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const arabic = ARABIC_INDIC.indexOf(ch);
    return String(arabic >= 0 ? arabic : EASTERN_PERSIAN.indexOf(ch));
  });
}
