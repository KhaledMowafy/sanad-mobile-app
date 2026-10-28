/**
 * The website's design tokens, as numbers and colour strings. Pine is the brand's green, copper its
 * accent, and the greys lean towards pine. Light is the default; dark follows the website's dark set.
 */

const pine = {
  50: '#eef5f3',
  100: '#d5e7e2',
  200: '#abcfc6',
  300: '#7fb4a8',
  400: '#4f9182',
  500: '#2f7364',
  600: '#1f5c51',
  700: '#164c44',
  800: '#103f3a',
  900: '#0b2f2b',
  950: '#07201d',
} as const;

const copper = {
  50: '#fbf3eb',
  100: '#f6e1cd',
  200: '#edc39d',
  300: '#de9d66',
  400: '#c8793a',
  500: '#a35c25',
  600: '#864a1e',
  700: '#6a3a19',
} as const;

const neutral = {
  0: '#fdfefd',
  50: '#f5f7f6',
  100: '#ecf0ee',
  200: '#dce2df',
  300: '#c2ccc8',
  400: '#97a49f',
  500: '#66736f',
  600: '#4f5b57',
  700: '#3e4946',
  800: '#29312f',
  900: '#1a2120',
  950: '#0e1513',
} as const;

export interface Colors {
  readonly bg: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly surfaceSunken: string;
  readonly surfaceHover: string;
  readonly sidebar: string;
  readonly userBubble: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textSubtle: string;
  readonly textDisabled: string;
  readonly primary: string;
  readonly primaryHover: string;
  readonly primaryText: string;
  readonly primarySoft: string;
  readonly onPrimary: string;
  readonly accent: string;
  readonly accentText: string;
  readonly accentSoft: string;
  readonly focus: string;
  readonly success: string;
  readonly successBg: string;
  readonly warning: string;
  readonly warningBg: string;
  readonly error: string;
  readonly errorBg: string;
  readonly info: string;
  readonly infoBg: string;
  readonly scrim: string;
  /** The deep pine panel of the privacy section, which is dark in both themes. */
  readonly panel: string;
  readonly onPanel: string;
}

export const lightColors: Colors = {
  bg: neutral[50],
  surface: neutral[0],
  surfaceRaised: neutral[0],
  surfaceSunken: neutral[100],
  surfaceHover: '#e6ece9',
  sidebar: '#eef2f0',
  userBubble: pine[50],
  border: neutral[200],
  borderStrong: neutral[300],
  text: neutral[900],
  textMuted: neutral[600],
  textSubtle: neutral[500],
  textDisabled: neutral[400],
  primary: pine[800],
  primaryHover: pine[700],
  primaryText: pine[800],
  primarySoft: pine[50],
  onPrimary: neutral[0],
  accent: copper[400],
  accentText: copper[500],
  accentSoft: copper[50],
  focus: copper[400],
  success: '#2e7a3c',
  successBg: '#e8f3ea',
  warning: '#8a6a00',
  warningBg: '#fbf3d4',
  error: '#b4322a',
  errorBg: '#fbe9e7',
  info: '#2f5e9e',
  infoBg: '#e8eff9',
  scrim: 'rgba(14, 21, 19, 0.45)',
  panel: pine[800],
  onPanel: neutral[0],
};

export const darkColors: Colors = {
  bg: neutral[950],
  surface: '#141d1b',
  surfaceRaised: '#1b2624',
  surfaceSunken: '#101816',
  surfaceHover: '#1f2a28',
  sidebar: '#111917',
  userBubble: '#16312c',
  border: '#2a3633',
  borderStrong: '#3a4744',
  text: '#e6ecea',
  textMuted: '#9daaa6',
  textSubtle: '#7a8884',
  textDisabled: '#56635f',
  primary: pine[300],
  primaryHover: '#9ac9be',
  primaryText: '#8fc4b7',
  primarySoft: '#16312c',
  onPrimary: pine[950],
  accent: copper[300],
  accentText: copper[300],
  accentSoft: '#2a1e14',
  focus: copper[300],
  success: '#7fb98a',
  successBg: '#16261a',
  warning: '#e3c266',
  warningBg: '#2a2410',
  error: '#e58c84',
  errorBg: '#2e1716',
  info: '#8db0e6',
  infoBg: '#15203a',
  scrim: 'rgba(0, 0, 0, 0.6)',
  panel: pine[900],
  onPanel: neutral[0],
};

/** 4px base, as on the website. */
export const space = {
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, full: 999 } as const;

/** The minimum comfortable touch target, and the smaller icon button. */
export const size = { control: 44, controlSm: 32, reading: 760 } as const;

/** Font sizes in points, from the website's scale. */
export const fontSize = {
  xs: 13,
  sm: 14,
  base: 16,
  lg: 17,
  h4: 18,
  h3: 22,
  h2: 28,
  h1: 36,
  display: 44,
} as const;

export type TextVariant = 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'lead' | 'body' | 'small' | 'caption';

/** Size, weight and line height per variant. Arabic needs more air between lines than Latin. */
export const textVariants: Record<
  TextVariant,
  { fontSize: number; weight: 400 | 500 | 600 | 700; lineHeight: { ar: number; en: number } }
> = {
  display: { fontSize: fontSize.display, weight: 600, lineHeight: { ar: 60, en: 52 } },
  h1: { fontSize: fontSize.h1, weight: 600, lineHeight: { ar: 50, en: 42 } },
  h2: { fontSize: fontSize.h2, weight: 600, lineHeight: { ar: 40, en: 34 } },
  h3: { fontSize: fontSize.h3, weight: 600, lineHeight: { ar: 31, en: 28 } },
  h4: { fontSize: fontSize.h4, weight: 600, lineHeight: { ar: 25, en: 23 } },
  lead: { fontSize: 19, weight: 400, lineHeight: { ar: 32, en: 28 } },
  body: { fontSize: fontSize.base, weight: 400, lineHeight: { ar: 29, en: 25 } },
  small: { fontSize: fontSize.sm, weight: 400, lineHeight: { ar: 23, en: 20 } },
  caption: { fontSize: fontSize.xs, weight: 400, lineHeight: { ar: 20, en: 18 } },
};

export const shadows = {
  card: {
    shadowColor: '#103f3a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  raised: {
    shadowColor: '#103f3a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 6,
  },
} as const;
