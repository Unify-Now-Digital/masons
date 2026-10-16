export interface SuggestionMessage {
  conversation_id: string;
  channel: string;
  direction: string;
  sent_at?: string | null;
  created_at: string;
}

function at(message: SuggestionMessage): number {
  const sent = message.sent_at ? new Date(message.sent_at).getTime() : Number.NaN;
  if (!Number.isNaN(sent)) return sent;
  const created = new Date(message.created_at).getTime();
  return Number.isNaN(created) ? 0 : created;
}

/**
 * The inbound we may suggest a reply to.
 * Null when the latest message in this conversation is ours: we are waiting on the customer.
 */
export function latestInboundNeedingReply<T extends SuggestionMessage>(
  messages: T[],
  conversationId: string | null,
  channel: string | null,
): T | null {
  if (!conversationId || !channel) return null;
  const inThread = messages.filter((message) => message.conversation_id === conversationId && message.channel === channel);
  if (inThread.length === 0) return null;
  const latest = inThread.reduce((best, message) => (at(message) >= at(best) ? message : best));
  return latest.direction === 'inbound' ? latest : null;
}
