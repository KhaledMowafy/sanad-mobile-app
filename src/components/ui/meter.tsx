import { StyleSheet, View } from 'react-native';
import type { UsageState } from '@/domain/entities/usage';
import { useTheme } from '@/theme/theme';
import { AppText } from './text';

/** A labelled progress bar. The colour says how close the limit is: pine, amber, red. */
export function Meter({
  label,
  text,
  used,
  limit,
  state,
}: {
  label: string;
  text: string;
  used: number;
  limit: number;
  state: UsageState;
}) {
  const { colors } = useTheme();
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const fill = state === 'exhausted' ? colors.error : state === 'warning' ? colors.warning : colors.primary;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <AppText variant="caption" weight={500} tone="muted">
          {label}
        </AppText>
        <AppText variant="caption" style={styles.numbers}>
          {text}
        </AppText>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: limit, now: Math.min(used, limit), text }}
        style={[styles.track, { backgroundColor: colors.surfaceSunken }]}
      >
        <View style={[styles.fill, { backgroundColor: fill, width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  numbers: { fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
