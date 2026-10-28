import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { DraftDto, MessageDto } from '@/application/dto/dto';
import { AssistantMessage, UserMessage } from './messages';
import { DraftCard } from './draft-card';

type Entry = { kind: 'message'; message: MessageDto } | { kind: 'draft'; draft: DraftDto };

/** Memos are documents, not messages, so they are slotted in by the time they were asked. */
function timeline(messages: MessageDto[], drafts: DraftDto[]): Entry[] {
  const entries: Entry[] = messages.map((message) => ({ kind: 'message', message }));
  for (const draft of drafts) {
    let at = entries.length;
    for (;;) {
      const previous = entries[at - 1];
      if (at > 0 && previous?.kind === 'message' && previous.message.createdAt > draft.createdAt) at -= 1;
      else break;
    }
    entries.splice(at, 0, { kind: 'draft', draft });
  }
  return entries;
}

const keyOf = (entry: Entry) => (entry.kind === 'draft' ? `draft-${entry.draft.id}` : entry.message.id);

/**
 * The conversation, oldest first. While an answer streams the list follows the newest text, but
 * only if the reader was already at the bottom: scrolling up to read stops it.
 */
export function Thread({ messages, drafts = [] }: { messages: MessageDto[]; drafts?: DraftDto[] }) {
  const list = useRef<FlatList<Entry>>(null);
  const atBottom = useRef(true);
  const last = messages.at(-1);
  const entries = timeline(messages, drafts);
  const signal = `${messages.length}:${last?.content.length ?? 0}:${drafts.map((d) => d.status).join()}`;

  useEffect(() => {
    if (atBottom.current) list.current?.scrollToEnd({ animated: false });
  }, [signal]);

  return (
    <FlatList
      ref={list}
      data={entries}
      keyExtractor={keyOf}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      onScroll={(event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 160;
      }}
      scrollEventThrottle={64}
      onContentSizeChange={() => {
        if (atBottom.current) list.current?.scrollToEnd({ animated: false });
      }}
      renderItem={({ item }) =>
        item.kind === 'draft' ? (
          <DraftCard draft={item.draft} />
        ) : item.message.role === 'user' ? (
          <UserMessage message={item.message} />
        ) : (
          <AssistantMessage message={item.message} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  gap: { height: 24 },
});
