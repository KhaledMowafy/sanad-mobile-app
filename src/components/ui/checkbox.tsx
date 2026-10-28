import { CheckSquare, Square } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';

/** A tick box with a label beside it. The label can hold links of its own. */
export function Checkbox({
  checked,
  onChange,
  accessibilityLabel,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        hitSlop={10}
        style={styles.box}
      >
        {checked ? (
          <CheckSquare size={24} weight="fill" color={colors.primary} />
        ) : (
          <Square size={24} color={colors.borderStrong} />
        )}
      </Pressable>
      <View style={styles.label}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  box: { paddingTop: 2 },
  label: { flex: 1 },
});
