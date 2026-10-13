import { describe, expect, it } from 'vitest';
import { buildOwnHandles } from './ownHandles';
import { selectNeedsAttentionAll, type NeedsAttentionConversation } from './needsAttention';

const conv = (overrides: Partial<NeedsAttentionConversation>): NeedsAttentionConversation =>
  ({
    id: 'c',
    primary_handle: 'customer@example.org',
    person_id: null,
    ai_priority: 50,
    last_message_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }) as NeedsAttentionConversation;

const options = {
  ownHandles: buildOwnHandles(['info@example.com']),
  mutedHandles: new Set(['muted@example.org']),
};
const ids = (rows: NeedsAttentionConversation[]) => rows.map((row) => row.id);

describe('selectNeedsAttentionAll', () => {
  it('drops unscored rows', () => {
    expect(ids(selectNeedsAttentionAll([conv({ id: 'a', ai_priority: null }), conv({ id: 'b' })], options))).toEqual(['b']);
  });

  it('drops unlinked muted, own-mailbox (padded) and own-domain rows', () => {
    const rows = [
      conv({ id: 'm', primary_handle: 'muted@example.org' }),
      conv({ id: 'o', primary_handle: ' Info@Example.com' }),
      conv({ id: 'd', primary_handle: 'someone@unifynow.digital' }),
      conv({ id: 'k' }),
    ];
    expect(ids(selectNeedsAttentionAll(rows, options))).toEqual(['k']);
  });

  it('keeps an own-handle row linked to a customer', () => {
    const rows = [
      conv({
        id: 'l',
        person_id: 'p1',
        primary_handle: 'someone@unifynow.digital',
        person: { email: 'customer@example.org', phone: null },
      }),
    ];
    expect(ids(selectNeedsAttentionAll(rows, options))).toEqual(['l']);
  });

  it('drops unlinked rows on an own subdomain', () => {
    const rows = [conv({ id: 's', primary_handle: 'noreply@lc.unifynow.digital' }), conv({ id: 'k' })];
    expect(ids(selectNeedsAttentionAll(rows, options))).toEqual(['k']);
  });

  it('drops an own-handle row whose linked person is ours too', () => {
    const rows = [
      conv({
        id: 'a',
        person_id: 'p1',
        primary_handle: 'someone@unifynow.digital',
        person: { email: 'Someone@UnifyNow.digital', phone: null },
      }),
      conv({ id: 'k' }),
    ];
    expect(ids(selectNeedsAttentionAll(rows, options))).toEqual(['k']);
  });

  it('keeps a customer-handle row even when its linked person is ours', () => {
    const rows = [
      conv({ id: 'f', person_id: 'p1', person: { email: 'someone@unifynow.digital', phone: null } }),
    ];
    expect(ids(selectNeedsAttentionAll(rows, options))).toEqual(['f']);
  });

  it('keeps one row per person, the highest priority', () => {
    const rows = [
      conv({ id: 'a', person_id: 'p1', ai_priority: 40 }),
      conv({ id: 'b', person_id: 'p1', ai_priority: 80 }),
      conv({ id: 'c', person_id: 'p2', ai_priority: 60 }),
    ];
    expect(ids(selectNeedsAttentionAll(rows, options))).toEqual(['b', 'c']);
  });

  it("on a priority tie keeps the person's newest row", () => {
    const rows = [
      conv({ id: 'a', person_id: 'p1', last_message_at: '2026-10-01T00:00:00Z' }),
      conv({ id: 'b', person_id: 'p1', last_message_at: '2026-10-05T00:00:00Z' }),
    ];
    expect(ids(selectNeedsAttentionAll(rows, options))).toEqual(['b']);
  });

  it('orders by priority, then newest, null timestamps last', () => {
    const rows = [
      conv({ id: 'x', last_message_at: null }),
      conv({ id: 'y', last_message_at: '2026-10-02T00:00:00Z' }),
      conv({ id: 'z', ai_priority: 90 }),
    ];
    expect(ids(selectNeedsAttentionAll(rows, options))).toEqual(['z', 'y', 'x']);
  });

  it('hides a dismissed row whose marker is at or after its last message', () => {
    const rows = [
      conv({ id: 'd', ai_dismissed_at: '2026-10-01T00:00:00Z' }),
      conv({ id: 'n', ai_dismissed_at: '2026-10-01T00:00:00Z', last_message_at: null }),
      conv({ id: 'k' }),
    ];
    expect(ids(selectNeedsAttentionAll(rows, options))).toEqual(['k']);
  });

  it('shows a dismissed row again once a newer message lands', () => {
    const rows = [
      conv({ id: 'r', ai_dismissed_at: '2026-10-01T00:00:00Z', last_message_at: '2026-10-02T00:00:00Z' }),
    ];
    expect(ids(selectNeedsAttentionAll(rows, options))).toEqual(['r']);
  });

  it("surfaces a person's next conversation when their top one is dismissed", () => {
    const rows = [
      conv({ id: 'a', person_id: 'p1', ai_priority: 80, ai_dismissed_at: '2026-10-01T00:00:00Z' }),
      conv({ id: 'b', person_id: 'p1', ai_priority: 40 }),
    ];
    expect(ids(selectNeedsAttentionAll(rows, options))).toEqual(['b']);
  });
});
