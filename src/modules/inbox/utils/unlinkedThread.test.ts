import { describe, expect, it } from 'vitest';
import type { InboxMessage } from '../types/inbox.types';
import { mergeUnlinkedMessages, unlinkedHandleKeys, withPreviewFallback, type UnlinkedPreviewRow } from './unlinkedThread';

const preview = (partial: Partial<UnlinkedPreviewRow> = {}): UnlinkedPreviewRow => ({
  id: 'conv-1',
  channel: 'sms',
  primary_handle: '+44 7845 846058',
  person_id: null,
  last_message_preview: 'Can you call me back?',
  last_message_at: '2026-10-14T09:00:00Z',
  subject: null,
  ...partial,
});

const message = (partial: Partial<InboxMessage> = {}): InboxMessage => ({
  id: 'm1',
  conversation_id: 'conv-1',
  channel: 'sms',
  direction: 'inbound',
  from_handle: '+447845846058',
  to_handle: '',
  body_text: 'Hello',
  subject: null,
  sent_at: '2026-10-14T09:00:00Z',
  status: 'delivered',
  created_at: '2026-10-14T09:00:00Z',
  updated_at: '2026-10-14T09:00:00Z',
  ...partial,
});

describe('unlinked thread', () => {
  it('asks the RPC for each unlinked phone or email handle in the group', () => {
    expect(unlinkedHandleKeys([
      preview(),
      preview({ id: 'conv-2', channel: 'whatsapp', primary_handle: '+44 7845 846058' }),
      preview({ id: 'conv-3', person_id: 'person-1', channel: 'email', primary_handle: 'a@b.com' }),
    ])).toEqual([
      { channel: 'sms', handle: '+44 7845 846058' },
      { channel: 'whatsapp', handle: '+44 7845 846058' },
    ]);
  });

  it('keeps the list preview when the message table returns nothing', () => {
    const rows = mergeUnlinkedMessages([], [], [preview()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.body_text).toBe('Can you call me back?');
    expect(rows[0]?.channel).toBe('sms');
  });

  it('prefers real messages and drops duplicates', () => {
    const rows = mergeUnlinkedMessages([message()], [message({ body_text: 'from rpc' })], [preview()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.body_text).toBe('from rpc');
  });

  it('shows a linked web preview when inbox_messages has no row', () => {
    const rows = withPreviewFallback([], [preview({
      id: 'aed09398-aa56-4e06-a8fb-c0a7bc4fb1f3',
      channel: 'web',
      person_id: 'd84576aa-9641-4f4d-ba29-4d06c4f65eb2',
      primary_handle: '+447845846058',
      last_message_preview: 'Hi Karen\n\nNo worries at all.',
      last_message_at: '2026-10-15T13:00:11Z',
    })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.channel).toBe('web');
    expect(rows[0]?.conversation_id).toBe('aed09398-aa56-4e06-a8fb-c0a7bc4fb1f3');
    expect(rows[0]?.body_text).toContain('No worries at all');
  });

  it('fills only the conversation that has no message rows', () => {
    const rows = withPreviewFallback(
      [message()],
      [preview(), preview({ id: 'web-1', channel: 'web', person_id: 'p', last_message_preview: 'Hi Karen' })],
    );
    expect(rows.map((row) => row.conversation_id).sort()).toEqual(['conv-1', 'web-1']);
  });
});
