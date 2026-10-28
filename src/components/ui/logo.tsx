import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { useTheme } from '@/theme/theme';

const LOCKUP = {
  light: require('../../../assets/brand/lockup-light.png'),
  dark: require('../../../assets/brand/lockup-dark.png'),
};
const WORDMARK = {
  light: require('../../../assets/brand/wordmark-light-sm.png'),
  dark: require('../../../assets/brand/wordmark-dark-sm.png'),
};
const ICON = require('../../../assets/brand/app-icon-sm.png');

/** The mark of the product, in the variant that reads on the current background. */
export function Logo({
  kind = 'wordmark',
  height = 28,
  style,
}: {
  kind?: 'wordmark' | 'lockup' | 'icon';
  height?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const { scheme } = useTheme();
  const source = kind === 'icon' ? ICON : kind === 'lockup' ? LOCKUP[scheme] : WORDMARK[scheme];
  return (
    <Image
      accessibilityLabel="سندك"
      source={source}
      resizeMode="contain"
      style={[{ height, width: kind === 'icon' ? height : height * 3.2 }, style]}
    />
  );
}
