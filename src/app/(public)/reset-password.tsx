import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { AuthFrame } from '@/components/auth/auth-frame';
import { PasswordRules } from '@/components/auth/password-rules';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useT } from '@/i18n/use-t';
import { getContainer } from '@/infrastructure/di/container';
import { failureOf, type FormFailure } from '@/presentation/auth/failure';

/** Step two of a password reset: the emailed code and the new password. */
export default function ResetPassword() {
  const t = useT('auth.reset');
  const errors = useT('auth.errors');
  const fields = useT('auth.fields');
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const message = (key: string | undefined) =>
    key ? (errors.has(key) ? errors(key) : errors('invalid')) : undefined;

  const passwordError = () => {
    if (!failure) return undefined;
    const specific = failure.details.password?.find((code) => code !== 'invalid');
    return message(specific ?? failure.fieldErrors.password);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    setResent(false);
    const result = await getContainer().useCases.resetPassword.execute({ email, code, password });
    setBusy(false);
    if (!result.ok) return setFailure(failureOf(result.error));
    router.replace({ pathname: '/signin', params: { reset: '1', email } });
  };

  const resend = async () => {
    if (sending) return;
    setSending(true);
    setFailure(null);
    const result = await getContainer().useCases.requestPasswordReset.execute({ email });
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
        maxLength={6}
        ltr
        error={message(failure?.fieldErrors.code)}
      />
      <TextField
        label={t('newPassword')}
        value={password}
        onChangeText={setPassword}
        password
        autoComplete="new-password"
        textContentType="newPassword"
        error={passwordError()}
      />
      <PasswordRules value={password} />
      <Button large label={busy ? t('submitting') : t('submit')} loading={busy} onPress={() => void submit()} />
      <Button variant="secondary" label={t('resend')} loading={sending} onPress={() => void resend()} />
    </AuthFrame>
  );
}
