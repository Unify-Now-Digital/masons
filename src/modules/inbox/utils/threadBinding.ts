/**
 * A thread, suggestion or draft may render only when it was loaded for the
 * selection on screen. A result fetched for the previous person is discarded.
 */
export function messagesForLoadedThread<T>(
  selectedKey: string | null,
  loadedKey: string | null,
  messages: T[],
): T[] {
  if (!selectedKey || selectedKey !== loadedKey) return [];
  return messages;
}

export function suggestionForLoadedMessage(
  selectedMessageId: string | null,
  loadedMessageId: string | null,
  suggestion: string | null,
): string | null {
  if (!suggestion || !selectedMessageId || selectedMessageId !== loadedMessageId) return null;
  return suggestion;
}
