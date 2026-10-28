import { X } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n/use-t';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { IconButton } from './icon-button';
import { AppText } from './text';

/**
 * A panel over the screen. "bottom" slides up from the edge, as the citation reader and the
 * template list do; "center" is a dialog. Tapping outside, or the back button, closes it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  placement = 'bottom',
  maxHeight = '85%',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  placement?: 'bottom' | 'center';
  maxHeight?: `${number}%`;
}) {
  const { colors } = useTheme();
  const t = useT('mobile');
  const insets = useSafeAreaInsets();
  const bottom = placement === 'bottom';

  return (
    <Modal
      visible={open}
      transparent
      animationType={bottom ? 'slide' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.root, { justifyContent: bottom ? 'flex-end' : 'center' }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              backgroundColor: colors.surfaceRaised,
              maxHeight,
              paddingBottom: bottom ? Math.max(insets.bottom, 12) : 16,
              marginHorizontal: bottom ? 0 : 20,
              borderBottomStartRadius: bottom ? 0 : radius.xl,
              borderBottomEndRadius: bottom ? 0 : radius.xl,
            },
          ]}
        >
          {title ? (
            <View style={styles.header}>
              <AppText variant="h4" style={styles.title}>
                {title}
              </AppText>
              <IconButton label={t('close')} onPress={onClose} small>
                <X size={18} color={colors.textMuted} />
              </IconButton>
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1 },
});
