import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AuthFrame } from '@/components/auth/auth-frame';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { RichText } from '@/components/ui/rich-text';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useT } from '@/i18n/use-t';
import { getContainer } from '@/infrastructure/di/container';
import { failureOf, type FormFailure } from '@/presentation/auth/failure';
import { useAuth } from '@/stores/auth-store';

export default function SignIn() {
  const t = useT('auth.signIn');
  const errors = useT('auth.errors');
  const fields = useT('auth.fields');
  const router = useRouter();
  const params = useLocalSearchParams<{ verified?: string; reset?: string; email?: string }>();
  const setUser = useAuth((s) => s.setUser);

  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const message = (code: string | undefined, values?: Record<string, string | number>) =>
    code ? (errors.has(code) ? errors(code, values) : errors('invalid')) : undefined;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    const result = await getContainer().useCases.signIn.execute({ email, password });
    setBusy(false);

    if (result.ok) {
      setUser(result.value);
      return;
    }
    // An account that was never verified goes to the code screen with its address filled in.
    if (result.error.kind === 'forbidden' && result.error.code === 'email_not_verified') {
      router.push({ pathname: '/verify-email', params: { email: email.trim().toLowerCase() } });
      return;
    }
    setFailure(failureOf(result.error));
  };

  return (
    <AuthFrame title={t('title')} subtitle={t('subtitle')}>
      {params.verified ? <Banner tone="success">{t('verifiedNotice')}</Banner> : null}
      {params.reset ? <Banner tone="success">{t('resetNotice')}</Banner> : null}
      {failure?.formError ? (
        <Banner tone="error">
          {message(failure.formError, failure.formParams) ?? errors('unavailable')}
        </Banner>
      ) : null}

      <TextField
        label={fields('email')}
        value={email}
        onChangeText={setEmail}
        placeholder={fields('emailPlaceholder')}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
        autoCorrect={false}
        ltr
        error={message(failure?.fieldErrors.email)}
      />
      <TextField
        label={fields('password')}
        value={password}
        onChangeText={setPassword}
        password
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void submit()}
        error={message(failure?.fieldErrors.password)}
      />

      <Pressable
        accessibilityRole="link"
        onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
        style={styles.forgot}
      >
        <AppText variant="small" tone="primary" weight={600}>
          {t('forgot')}
        </AppText>
      </Pressable>

      <Button large label={busy ? t('submitting') : t('submit')} loading={busy} onPress={() => void submit()} />

      <View style={styles.row}>
        <AppText variant="small" tone="muted">
          {t('noAccount')}
        </AppText>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/signup')}>
          <AppText variant="small" tone="primary" weight={600}>
            {t('createAccount')}
          </AppText>
        </Pressable>
      </View>

      <View style={styles.row}>
        <AppText variant="small" tone="muted">
          {t('notVerified')}
        </AppText>
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            router.push({ pathname: '/verify-email', params: { email: email.trim().toLowerCase() } })
          }
        >
          <AppText variant="small" tone="primary" weight={600}>
            {t('enterCode')}
          </AppText>
        </Pressable>
      </View>

      <RichText
        variant="caption"
        tone="subtle"
        align="center"
        message={t.raw<string>('legal')}
        handlers={{
          terms: () => router.push('/legal?kind=terms'),
          privacy: () => router.push('/legal?kind=privacy'),
        }}
      />
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
});
