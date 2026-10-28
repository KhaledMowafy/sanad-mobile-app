import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AuthFrame } from '@/components/auth/auth-frame';
import { AppText } from '@/components/ui/text';
import { useT } from '@/i18n/use-t';

/** The terms and the privacy policy. The full texts are shells until the legal text is supplied. */
export default function Legal() {
  const t = useT('legal');
  const mobile = useT('mobile');
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const privacy = kind === 'privacy';
  const summary = t.raw<string[]>('privacySummary');

  return (
    <AuthFrame title={privacy ? t('privacyTitle') : t('termsTitle')}>
      <AppText tone="muted">{mobile('legalSoon')}</AppText>
      {privacy ? (
        <View style={styles.block}>
          <AppText variant="h4">{t('privacySummaryTitle')}</AppText>
          {summary.map((line) => (
            <AppText key={line}>• {line}</AppText>
          ))}
        </View>
      ) : null}
      <View style={styles.block}>
        <AppText variant="h4">{t('disclaimerTitle')}</AppText>
        <AppText tone="muted">{t('disclaimer')}</AppText>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({ block: { gap: 8 } });
