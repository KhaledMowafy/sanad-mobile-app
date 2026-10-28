import { CheckCircle, Info, WarningCircle } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { AppText } from './text';

export type BannerTone = 'error' | 'warning' | 'success' | 'info';

/** A coloured notice: an error, a warning, a confirmation or a note. Errors are announced at once. */
export function Banner({
  tone,
  children,
  action,
}: {
  tone: BannerTone;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  const palette = {
    error: { bg: colors.errorBg, fg: colors.error, Icon: WarningCircle },
    warning: { bg: colors.warningBg, fg: colors.warning, Icon: WarningCircle },
    success: { bg: colors.successBg, fg: colors.success, Icon: CheckCircle },
    info: { bg: colors.infoBg, fg: colors.info, Icon: Info },
  }[tone];

  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      style={[styles.box, { backgroundColor: palette.bg }]}
    >
      <palette.Icon size={18} color={palette.fg} weight="fill" style={styles.icon} />
      <View style={styles.body}>
        {typeof children === 'string' ? (
          <AppText variant="small" weight={500} style={{ color: palette.fg }}>
            {children}
          </AppText>
        ) : (
          children
        )}
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  icon: { marginTop: 3 },
  body: { flex: 1, gap: 6 },
});
