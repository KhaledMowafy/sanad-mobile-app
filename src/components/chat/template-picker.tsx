import { MagnifyingGlass } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { TemplateDto } from '@/application/dto/dto';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { AppText } from '@/components/ui/text';
import { isWizardTemplate, templateGroupOf, type TemplateGroup } from '@/domain/entities/template';
import { useT } from '@/i18n/use-t';
import { templateApi } from '@/presentation/chat/template-client';
import { useTheme } from '@/theme/theme';
import { radius, size } from '@/theme/tokens';

/** The catalogue is small and rarely changes, so it is read once per run and per group. */
const cache = new Map<string, TemplateDto[]>();

type Load =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; items: TemplateDto[] };

/**
 * Lists the document templates a card offers. A contract that has a wizard opens it; anything
 * else becomes the composer's chosen document. With no group it shows everything, grouped.
 */
export function TemplatePicker({
  open,
  group,
  onClose,
  onPick,
}: {
  open: boolean;
  /** Only the templates of one card, or all of them when null. */
  group: TemplateGroup | null;
  onClose: () => void;
  onPick: (template: TemplateDto) => void;
}) {
  const t = useT('chat.templates');
  const { colors, font } = useTheme();
  const [results, setResults] = useState<Record<string, TemplateDto[] | 'failed'>>({});
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const key = group ?? 'all';
  const entry = cache.get(key) ?? results[key];

  const load = useMemo<Load>(
    () =>
      entry === undefined
        ? { status: 'loading' }
        : entry === 'failed'
          ? { status: 'failed' }
          : { status: 'ready', items: entry },
    [entry],
  );

  useEffect(() => {
    if (!open || cache.has(key)) return;
    let cancelled = false;
    void templateApi.list(group ?? undefined).then((items) => {
      if (cancelled) return;
      if (items) cache.set(key, items);
      setResults((current) => ({ ...current, [key]: items ?? 'failed' }));
    });
    return () => {
      cancelled = true;
    };
  }, [open, key, group, attempt]);

  const visible = useMemo(() => {
    if (load.status !== 'ready') return [];
    const needle = query.trim().toLowerCase();
    return needle ? load.items.filter((item) => item.name.toLowerCase().includes(needle)) : load.items;
  }, [load, query]);

  const title =
    group === 'contract' ? t('contractTitle') : group === 'paperwork' ? t('paperworkTitle') : t('allTitle');
  const sections: { label: string | null; items: TemplateDto[] }[] =
    group === null
      ? [
          { label: t('contracts'), items: visible.filter((i) => templateGroupOf(i) === 'contract') },
          { label: t('paperwork'), items: visible.filter((i) => templateGroupOf(i) === 'paperwork') },
        ].filter((section) => section.items.length > 0)
      : [{ label: null, items: visible }];

  return (
    <Sheet open={open} onClose={onClose} title={title} maxHeight="85%">
      <View style={[styles.search, { backgroundColor: colors.bg, borderColor: colors.borderStrong }]}>
        <MagnifyingGlass size={16} color={colors.textSubtle} />
        <TextInput
          accessibilityLabel={t('search')}
          value={query}
          onChangeText={setQuery}
          placeholder={t('search')}
          placeholderTextColor={colors.textSubtle}
          style={[styles.input, { color: colors.text, fontFamily: font(400) }]}
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
        {load.status === 'loading' ? (
          <View style={styles.center} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary} />
            <AppText variant="small" tone="muted">
              {t('loading')}
            </AppText>
          </View>
        ) : load.status === 'failed' ? (
          <View style={styles.center} accessibilityRole="alert">
            <AppText variant="small" tone="error">
              {t('failed')}
            </AppText>
            <Button
              variant="secondary"
              label={t('retry')}
              onPress={() => {
                setResults((current) => {
                  const next = { ...current };
                  delete next[key];
                  return next;
                });
                setAttempt((n) => n + 1);
              }}
            />
          </View>
        ) : visible.length === 0 ? (
          <AppText variant="small" tone="muted" align="center" style={styles.empty}>
            {t('empty')}
          </AppText>
        ) : (
          sections.map((section) => (
            <View key={section.label ?? 'one'} style={styles.section}>
              {section.label ? (
                <AppText variant="small" weight={600} tone="muted">
                  {section.label}
                </AppText>
              ) : null}
              {section.items.map((item) => (
                <Pressable
                  key={item.code}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  onPress={() => {
                    onPick(item);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <AppText weight={500}>{item.name}</AppText>
                  {isWizardTemplate(item) ? (
                    <AppText variant="caption" tone="primary">
                      {t('wizard')}
                    </AppText>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: size.control,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  list: { gap: 16, paddingVertical: 8 },
  section: { gap: 8 },
  item: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  empty: { paddingVertical: 24 },
});
