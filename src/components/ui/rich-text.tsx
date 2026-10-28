import { StyleSheet } from 'react-native';
import { AppText, type AppTextProps } from './text';

type Handlers = Record<string, () => void>;

interface Segment {
  text: string;
  tag: string | null;
}

/** Splits "text <terms>link</terms> text" into plain and tagged pieces. Unknown tags stay plain. */
export function splitTags(message: string, tags: readonly string[]): Segment[] {
  const pattern = new RegExp(`<(${tags.join('|')})>(.*?)</\\1>`, 'g');
  const segments: Segment[] = [];
  let last = 0;
  for (const match of message.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: message.slice(last, index), tag: null });
    segments.push({ text: match[2] ?? '', tag: match[1] ?? null });
    last = index + match[0].length;
  }
  if (last < message.length) segments.push({ text: message.slice(last), tag: null });
  return segments;
}

/**
 * A sentence with tappable pieces, for the website's messages that carry <terms> and <privacy>
 * tags. The raw message is passed in; each tag named in `handlers` becomes a link.
 */
export function RichText({
  message,
  handlers,
  ...rest
}: Omit<AppTextProps, 'children'> & { message: string; handlers: Handlers }) {
  const segments = splitTags(message, Object.keys(handlers));
  return (
    <AppText {...rest}>
      {segments.map((segment, index) =>
        segment.tag ? (
          <AppText
            key={index}
            variant={rest.variant ?? 'small'}
            tone="primary"
            weight={600}
            accessibilityRole="link"
            onPress={handlers[segment.tag]}
            style={styles.link}
          >
            {segment.text}
          </AppText>
        ) : (
          segment.text
        ),
      )}
    </AppText>
  );
}

const styles = StyleSheet.create({ link: { textDecorationLine: 'underline' } });
