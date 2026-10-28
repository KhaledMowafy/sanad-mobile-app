import { Eye, EyeSlash } from 'phosphor-react-native';
import { forwardRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useT } from '@/i18n/use-t';
import { useTheme } from '@/theme/theme';
import { radius, size } from '@/theme/tokens';
import { AppText } from './text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** An error message to show under the field. */
  error?: string | undefined;
  /** A hint under the field when there is no error. */
  hint?: string | undefined;
  /** Adds a show and hide button, and hides the characters. */
  password?: boolean;
  /** Email addresses and codes read left to right even in Arabic. */
  ltr?: boolean;
}

/** A labelled input with the website's border, error line and show-password button. */
export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, error, hint, password = false, ltr = false, ...rest },
  ref,
) {
  const { colors, font } = useTheme();
  const t = useT('auth.fields');
  const [shown, setShown] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <AppText variant="small" weight={500}>
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : focused ? colors.primary : colors.borderStrong,
          },
        ]}
      >
        <TextInput
          {...rest}
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={password && !shown}
          autoCapitalize={rest.autoCapitalize ?? 'none'}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          style={[
            styles.input,
            {
              color: colors.text,
              fontFamily: font(400),
              textAlign: ltr || password ? 'left' : undefined,
              writingDirection: ltr ? 'ltr' : undefined,
            },
          ]}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? t('hidePassword') : t('showPassword')}
            onPress={() => setShown((value) => !value)}
            hitSlop={8}
            style={styles.toggle}
          >
            {shown ? (
              <EyeSlash size={20} color={colors.textMuted} />
            ) : (
              <Eye size={20} color={colors.textMuted} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="small" tone="error" accessibilityRole="alert">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="small" tone="subtle">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: size.control + 4,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  toggle: { paddingStart: 8 },
});
