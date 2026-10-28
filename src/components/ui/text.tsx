import type { ReactNode } from 'react';
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { useTheme, type FontWeight } from '@/theme/theme';
import { textVariants, type Colors, type TextVariant } from '@/theme/tokens';

export type Tone =
  | 'text'
  | 'muted'
  | 'subtle'
  | 'disabled'
  | 'primary'
  | 'onPrimary'
  | 'accent'
  | 'error'
  | 'success'
  | 'warning'
  | 'info'
  | 'onPanel';

function colorFor(tone: Tone, c: Colors): string {
  switch (tone) {
    case 'text':
      return c.text;
    case 'muted':
      return c.textMuted;
    case 'subtle':
      return c.textSubtle;
    case 'disabled':
      return c.textDisabled;
    case 'primary':
      return c.primaryText;
    case 'onPrimary':
      return c.onPrimary;
    case 'accent':
      return c.accentText;
    case 'error':
      return c.error;
    case 'success':
      return c.success;
    case 'warning':
      return c.warning;
    case 'info':
      return c.info;
    case 'onPanel':
      return c.onPanel;
  }
}

export interface AppTextProps extends Omit<TextProps, 'style'> {
  variant?: TextVariant;
  tone?: Tone;
  weight?: FontWeight;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

/**
 * Every piece of text goes through here: the website's type scale, the font of the chosen
 * language, and line heights that suit Arabic. Alignment follows the reading direction unless a
 * screen says otherwise.
 */
export function AppText({
  variant = 'body',
  tone = 'text',
  weight,
  align,
  style,
  ...rest
}: AppTextProps) {
  const { colors, font, locale } = useTheme();
  const spec = textVariants[variant];
  return (
    <RNText
      {...rest}
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      style={[
        {
          fontFamily: font(weight ?? spec.weight),
          fontSize: spec.fontSize,
          lineHeight: spec.lineHeight[locale],
          color: colorFor(tone, colors),
        },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
