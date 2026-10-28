import { CheckCircle } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/text';
import { useT } from '@/i18n/use-t';
import { useTheme } from '@/theme/theme';

/** The three rules a password must meet, ticking as the person types. Mirrors the website's check. */
export function PasswordRules({ value }: { value: string }) {
  const t = useT('auth.signUp');
  const { colors } = useTheme();
  const rules = [
    { label: t('ruleLength'), met: value.length >= 8 },
    { label: t('ruleUppercase'), met: /[A-Z]/.test(value) },
    { label: t('ruleSpecial'), met: /[^A-Za-z0-9\s]/.test(value) },
  ];

  return (
    <View style={styles.wrap} accessibilityLabel={t('passwordRules')}>
      <AppText variant="small" tone="muted">
        {t('passwordRules')}
      </AppText>
      {rules.map((rule) => (
        <View
          key={rule.label}
          accessible
          accessibilityLabel={`${rule.label}: ${rule.met ? t('ruleMet') : t('ruleUnmet')}`}
          style={styles.row}
        >
          {rule.met ? (
            <CheckCircle size={18} weight="fill" color={colors.success} />
          ) : (
            <View style={[styles.empty, { borderColor: colors.textSubtle }]} />
          )}
          <AppText variant="small" tone={rule.met ? 'success' : 'muted'}>
            {rule.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, margin: 1 },
});
