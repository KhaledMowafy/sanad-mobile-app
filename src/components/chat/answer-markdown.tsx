import { memo, useMemo } from 'react';
import { Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '@/theme/theme';
import { fontSize, radius } from '@/theme/tokens';

/**
 * Answers are Markdown: bold, lists, tables, quotes. Raw HTML is never rendered, images are
 * dropped, and a link opens in the browser. Styles come from the website's tokens.
 */
export const AnswerMarkdown = memo(function AnswerMarkdown({ children }: { children: string }) {
  const { colors, font, locale } = useTheme();

  const style = useMemo(() => {
    const lineHeight = locale === 'ar' ? 30 : 26;
    const text = { color: colors.text, fontFamily: font(400), fontSize: fontSize.lg, lineHeight };
    return {
      body: text,
      paragraph: { marginTop: 0, marginBottom: 12 },
      strong: { fontFamily: font(700) },
      em: { fontStyle: 'italic' as const },
      heading1: { ...text, fontFamily: font(600), marginTop: 12, marginBottom: 8 },
      heading2: { ...text, fontFamily: font(600), marginTop: 12, marginBottom: 8 },
      heading3: { ...text, fontFamily: font(600), marginTop: 10, marginBottom: 6 },
      heading4: { ...text, fontFamily: font(600), marginTop: 10, marginBottom: 6 },
      heading5: { ...text, fontFamily: font(600) },
      heading6: { ...text, fontFamily: font(600) },
      bullet_list: { marginBottom: 12 },
      ordered_list: { marginBottom: 12 },
      list_item: { marginBottom: 4 },
      blockquote: {
        backgroundColor: colors.surfaceSunken,
        borderColor: colors.borderStrong,
        borderWidth: 1,
        borderLeftWidth: 1,
        borderRadius: radius.md,
        marginLeft: 0,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 4,
      },
      hr: { backgroundColor: colors.border, height: 1, marginVertical: 16 },
      code_inline: {
        backgroundColor: colors.surfaceSunken,
        color: colors.text,
        borderRadius: 4,
        paddingHorizontal: 4,
      },
      code_block: { backgroundColor: colors.surfaceSunken, color: colors.text, borderColor: colors.border },
      fence: { backgroundColor: colors.surfaceSunken, color: colors.text, borderColor: colors.border },
      link: { color: colors.primaryText, textDecorationLine: 'underline' as const },
      table: { borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, marginBottom: 12 },
      thead: { backgroundColor: colors.surfaceSunken },
      th: { padding: 8, borderColor: colors.border, fontFamily: font(600) },
      td: { padding: 8, borderColor: colors.border },
      tr: { borderColor: colors.border },
    };
  }, [colors, font, locale]);

  const rules = useMemo(
    () => ({
      // A picture inside an answer would load from somewhere unknown.
      image: () => null,
    }),
    [],
  );

  return (
    <Markdown
      style={style}
      rules={rules}
      onLinkPress={(url) => {
        void Linking.openURL(url).catch(() => undefined);
        return false;
      }}
    >
      {children}
    </Markdown>
  );
});
