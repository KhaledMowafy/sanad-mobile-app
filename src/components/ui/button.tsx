import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius, size } from '@/theme/tokens';
import { AppText, type Tone } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** A larger target for the main action of a screen. */
  large?: boolean;
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** The website's buttons: pine for the main action, an outline for the rest, never below 44pt tall. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  large = false,
  disabled = false,
  loading = false,
  block = false,
  icon,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; border: string; tone: Tone }> = {
    primary: { bg: colors.primary, border: 'transparent', tone: 'onPrimary' },
    secondary: { bg: colors.surface, border: colors.borderStrong, tone: 'text' },
    ghost: { bg: 'transparent', border: 'transparent', tone: 'muted' },
    danger: { bg: colors.errorBg, border: 'transparent', tone: 'error' },
  };
  const { bg, border, tone } = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: inactive && variant === 'primary' ? colors.surfaceSunken : bg,
          borderColor: border,
          minHeight: large ? 52 : size.control,
          opacity: pressed ? 0.85 : inactive ? 0.7 : 1,
        },
        block ? styles.block : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? colors.onPrimary : colors.text} />
      ) : (
        <View style={styles.row}>
          {icon}
          <AppText
            weight={600}
            tone={inactive && variant === 'primary' ? 'disabled' : tone}
            style={styles.label}
            numberOfLines={1}
          >
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  block: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { textAlign: 'center' },
});
