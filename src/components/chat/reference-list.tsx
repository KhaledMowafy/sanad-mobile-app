import { StyleSheet, View } from 'react-native';
import type { ReferenceDto } from '@/application/dto/dto';
import { Tag } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { groupReferences, referenceKind } from '@/domain/services/library-references';
import { useT } from '@/i18n/use-t';
import { useTheme } from '@/theme/theme';

function Group({ title, hint, items }: { title: string; hint?: string; items: ReferenceDto[] }) {
  const t = useT('chat.references');
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <AppText variant="caption" weight={600} tone="subtle">
        {hint ? `${title} — ${hint}` : title}
      </AppText>
      {items.map((reference) => {
        const kind = referenceKind(reference);
        return (
          <View key={reference.id} style={styles.row}>
            <Tag
              label={t(`kind.${kind}`)}
              tone={kind === 'CASSATION' ? 'success' : 'muted'}
              background={kind === 'CASSATION' ? colors.successBg : colors.surfaceSunken}
            />
            <AppText variant="small" tone="muted" selectable style={styles.label}>
              {reference.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The Cassation rulings and books an answer drew on, and those retrieved for it without being
 * named. Their text is not served, so each is a line, not a chip that opens.
 */
export function ReferenceList({ references }: { references: ReferenceDto[] }) {
  const t = useT('chat.references');
  const { used, related } = groupReferences(references);
  if (used.length === 0 && related.length === 0) return null;
  return (
    <View accessibilityLabel={t('label')} style={styles.list}>
      {used.length > 0 ? <Group title={t('used')} items={used} /> : null}
      {related.length > 0 ? <Group title={t('related')} hint={t('relatedHint')} items={related} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  group: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  label: { flex: 1 },
});
