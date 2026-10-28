import { useRouter } from 'expo-router';
import { ArrowRight, ArrowLeft, Paperclip } from 'phosphor-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { UseCaseCards } from '@/components/use-case-cards';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Sheet } from '@/components/ui/sheet';
import { AppText } from '@/components/ui/text';
import { useT } from '@/i18n/use-t';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

/**
 * The question box of the welcome page. Nobody is signed in here, so asking opens a prompt to
 * create an account or sign in instead of sending anything.
 */
export function HeroAsk() {
  const t = useT('hero.ask');
  const cases = useT('useCases');
  const { colors, font, rtl } = useTheme();
  const router = useRouter();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [value, setValue] = useState('');
  const [gate, setGate] = useState(false);
  const Send = rtl ? ArrowLeft : ArrowRight;

  return (
    <Card raised style={styles.card}>
      <AppText variant="h3">{t('title')}</AppText>

      <View style={[styles.box, { backgroundColor: colors.bg, borderColor: colors.borderStrong }]}>
        <IconButton label={t('attach')} onPress={() => setGate(true)}>
          <Paperclip size={22} color={colors.textMuted} />
        </IconButton>
        <TextInput
          ref={input}
          accessibilityLabel={t('label')}
          value={value}
          onChangeText={setValue}
          placeholder={t('placeholder')}
          placeholderTextColor={colors.textSubtle}
          multiline
          style={[styles.input, { color: colors.text, fontFamily: font(400) }]}
        />
        <IconButton label={t('send')} onPress={() => setGate(true)} style={{ backgroundColor: colors.primary }}>
          <Send size={20} color={colors.onPrimary} />
        </IconButton>
      </View>

      <UseCaseCards
        onPick={(key) => {
          // A starter, not a send: the person finishes the sentence, then asks.
          setValue(cases(`${key}.starter`));
          input.current?.focus();
        }}
      />

      <Sheet open={gate} onClose={() => setGate(false)} placement="center">
        <View style={styles.gate}>
          <AppText variant="h3">{t('gate.title')}</AppText>
          <AppText tone="muted">{t('gate.body')}</AppText>
          <Button
            large
            label={t('gate.signUp')}
            onPress={() => {
              setGate(false);
              router.push('/signup');
            }}
          />
          <Button
            large
            variant="secondary"
            label={t('gate.signIn')}
            onPress={() => {
              setGate(false);
              router.push('/signin');
            }}
          />
          <Button variant="ghost" label={t('gate.close')} onPress={() => setGate(false)} />
        </View>
      </Sheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16, borderRadius: radius.xl },
  box: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: 6,
    gap: 4,
  },
  input: { flex: 1, minHeight: 44, maxHeight: 140, fontSize: 16, paddingHorizontal: 6, paddingTop: 10, paddingBottom: 10 },
  gate: { gap: 12, paddingVertical: 8 },
});
