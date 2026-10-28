import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { AuthFrame } from '@/components/auth/auth-frame';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useT } from '@/i18n/use-t';
import { getContainer } from '@/infrastructure/di/container';
import { failureOf, type FormFailure } from '@/presentation/auth/failure';

/** Step one of a password reset: the backend emails a code, whether or not the account exists. */
export default function ForgotPassword() {
  const t = useT('auth.forgot');
  const errors = useT('auth.errors');
  const fields = useT('auth.fields');
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const message = (key: string | undefined) =>
    key ? (errors.has(key) ? errors(key) : errors('invalid')) : undefined;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    const result = await getContainer().useCases.requestPasswordReset.execute({ email });
    setBusy(false);
    if (!result.ok) return setFailure(failureOf(result.error));
    router.replace({ pathname: '/reset-password', params: { email: result.value.email } });
  };

  return (
    <AuthFrame title={t('title')} subtitle={t('subtitle')}>
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
        onSubmitEditing={() => void submit()}
        error={message(failure?.fieldErrors.email)}
      />
      <Button large label={busy ? t('submitting') : t('submit')} loading={busy} onPress={() => void submit()} />
      <Button variant="ghost" label={t('back')} onPress={() => router.replace('/signin')} />
    </AuthFrame>
  );
}
