import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius, shadows } from '@/theme/tokens';
import { AppText, type Tone } from './text';

export function Card({
  children,
  raised = false,
  highlighted = false,
  padded = true,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  raised?: boolean;
  highlighted?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: highlighted ? colors.primary : colors.border,
          borderWidth: highlighted ? 1.5 : 1,
        },
        padded ? styles.padded : null,
        raised ? shadows.raised : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A small pill: a status, a kind, a plan. */
export function Tag({
  label,
  tone = 'muted',
  background,
}: {
  label: string;
  tone?: Tone;
  background?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: background ?? colors.surfaceSunken },
      ]}
    >
      <AppText variant="caption" weight={600} tone={tone}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg },
  padded: { padding: 16 },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
});
