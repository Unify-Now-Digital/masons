import { describe, expect, it } from 'vitest';
import { latestInboundNeedingReply } from './suggestionGate';

const message = (partial: { id: string; direction: string; sent_at: string }) => ({
  id: partial.id,
  conversation_id: '255cf8ff-185a-4c46-ac81-27bfe1bd3625',
  channel: 'email',
  direction: partial.direction,
  sent_at: partial.sent_at,
  created_at: partial.sent_at,
});

describe('latestInboundNeedingReply', () => {
  it('does not suggest a reply when we wrote last', () => {
    const messages = [
      message({ id: 'in', direction: 'inbound', sent_at: '2026-10-12T16:53:00Z' }),
      message({ id: 'out', direction: 'outbound', sent_at: '2026-10-16T10:57:54Z' }),
    ];
    expect(latestInboundNeedingReply(messages, messages[0].conversation_id, 'email')).toBeNull();
  });

  it('suggests against the latest inbound when the customer wrote last', () => {
    const messages = [
      message({ id: 'out', direction: 'outbound', sent_at: '2026-10-12T12:00:00Z' }),
      message({ id: 'in', direction: 'inbound', sent_at: '2026-10-16T10:57:54Z' }),
    ];
    expect(latestInboundNeedingReply(messages, messages[0].conversation_id, 'email')?.id).toBe('in');
  });
});
