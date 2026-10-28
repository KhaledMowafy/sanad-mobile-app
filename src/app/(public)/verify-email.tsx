import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AuthFrame } from '@/components/auth/auth-frame';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useT } from '@/i18n/use-t';
import { getContainer } from '@/infrastructure/di/container';
import { failureOf, type FormFailure } from '@/presentation/auth/failure';

/** Finishes sign-up: the six-digit code sent to the email address activates the account. */
export default function VerifyEmail() {
  const t = useT('auth.verify');
  const errors = useT('auth.errors');
  const fields = useT('auth.fields');
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const message = (key: string | undefined) =>
    key ? (errors.has(key) ? errors(key) : errors('invalid')) : undefined;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    setResent(false);
    const result = await getContainer().useCases.verifyEmail.execute({ email, code });
    setBusy(false);
    if (!result.ok) return setFailure(failureOf(result.error));
    router.replace({ pathname: '/signin', params: { verified: '1', email } });
  };

  const resend = async () => {
    if (sending) return;
    setSending(true);
    setFailure(null);
    const result = await getContainer().useCases.resendVerification.execute({ email });
    setSending(false);
    if (!result.ok) return setFailure(failureOf(result.error));
    setResent(true);
  };

  return (
    <AuthFrame title={t('title')} subtitle={t('subtitle')}>
      {resent ? <Banner tone="success">{t('resent')}</Banner> : null}
      {failure?.formError ? (
        <Banner tone="error">{message(failure.formError) ?? errors('unavailable')}</Banner>
      ) : null}

      <TextField
        label={fields('email')}
        value={email}
        onChangeText={setEmail}
        placeholder={fields('emailPlaceholder')}
        keyboardType="email-address"
        autoComplete="email"
        autoCorrect={false}
        ltr
        error={message(failure?.fieldErrors.email)}
      />
      <TextField
        label={fields('code')}
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        ltr
        onSubmitEditing={() => void submit()}
        error={message(failure?.fieldErrors.code)}
      />

      <Button large label={busy ? t('submitting') : t('submit')} loading={busy} onPress={() => void submit()} />
      <Button
        variant="secondary"
        label={t('resend')}
        loading={sending}
        onPress={() => void resend()}
        style={styles.secondary}
      />
      <Button variant="ghost" label={t('backToSignIn')} onPress={() => router.replace('/signin')} />
    </AuthFrame>
  );
}

const styles = StyleSheet.create({ secondary: { alignSelf: 'stretch' } });
