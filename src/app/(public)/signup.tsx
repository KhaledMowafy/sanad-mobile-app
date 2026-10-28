import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AuthFrame } from '@/components/auth/auth-frame';
import { PasswordRules } from '@/components/auth/password-rules';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RichText } from '@/components/ui/rich-text';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useT } from '@/i18n/use-t';
import { getContainer } from '@/infrastructure/di/container';
import { failureOf, type FormFailure } from '@/presentation/auth/failure';

export default function SignUp() {
  const t = useT('auth.signUp');
  const errors = useT('auth.errors');
  const fields = useT('auth.fields');
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure | null>(null);

  const message = (code: string | undefined) =>
    code ? (errors.has(code) ? errors(code) : errors('invalid')) : undefined;

  /** The first password problem the backend named, else the generic one. */
  const passwordError = (): string | undefined => {
    if (!failure) return undefined;
    const specific = failure.details.password?.find((code) => code !== 'invalid');
    return message(specific ?? failure.fieldErrors.password);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    const result = await getContainer().useCases.signUp.execute({
      name,
      email,
      password,
      acceptedTerms: accepted,
    });
    setBusy(false);
    if (!result.ok) return setFailure(failureOf(result.error));
    router.replace({ pathname: '/verify-email', params: { email: result.value.email } });
  };

  const emailTaken = failure?.fieldErrors.email === 'email_registered';

  return (
    <AuthFrame title={t('title')} subtitle={t('subtitle')}>
      {failure?.formError ? <Banner tone="error">{message(failure.formError) ?? errors('unavailable')}</Banner> : null}

      <TextField
        label={fields('name')}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        error={message(failure?.fieldErrors.name)}
      />
      <TextField
        label={fields('email')}
        value={email}
        onChangeText={setEmail}
        placeholder={fields('emailPlaceholder')}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
        ltr
        error={emailTaken ? undefined : message(failure?.fieldErrors.email)}
      />
      {emailTaken ? (
        <Banner tone="error">
          <RichText
            variant="small"
            message={errors.raw<string>('email_registered')}
            handlers={{ link: () => router.replace({ pathname: '/signin', params: { email } }) }}
          />
        </Banner>
      ) : null}
      <TextField
        label={fields('password')}
        value={password}
        onChangeText={setPassword}
        password
        autoComplete="new-password"
        textContentType="newPassword"
        error={passwordError()}
      />
      <PasswordRules value={password} />

      <Checkbox
        checked={accepted}
        onChange={setAccepted}
        accessibilityLabel={errors('terms_required')}
      >
        <RichText
          variant="small"
          tone="muted"
          message={t.raw<string>('terms')}
          handlers={{
            terms: () => router.push('/legal?kind=terms'),
            privacy: () => router.push('/legal?kind=privacy'),
          }}
        />
        {failure?.fieldErrors.acceptedTerms ? (
          <AppText variant="small" tone="error" accessibilityRole="alert">
            {message(failure.fieldErrors.acceptedTerms)}
          </AppText>
        ) : null}
      </Checkbox>

      <Button large label={busy ? t('submitting') : t('submit')} loading={busy} onPress={() => void submit()} />

      <View style={styles.row}>
        <AppText variant="small" tone="muted">
          {t('haveAccount')}
        </AppText>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/signin')}>
          <AppText variant="small" tone="primary" weight={600}>
            {t('signInLink')}
          </AppText>
        </Pressable>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
});
