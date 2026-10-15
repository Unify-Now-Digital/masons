import { describe, expect, it } from 'vitest';
import { eventHref, filterFeed, groupFeed, unreadActionCount, type FeedEvent } from './feed';

const now = new Date('2026-10-15T18:00:00Z');

function event(partial: Partial<FeedEvent> & Pick<FeedEvent, 'id'>): FeedEvent {
  return {
    type: 'invoice.paid',
    category: 'finance',
    priority: 'fyi',
    entity_type: 'invoice',
    entity_id: null,
    order_id: null,
    actor_type: 'stripe',
    title: 'Invoice paid',
    body: null,
    payload: null,
    created_at: '2026-10-15T12:00:00Z',
    resolved_at: null,
    ...partial,
  };
}

describe('activity feed', () => {
  const events = [
    event({ id: 'today', priority: 'action', category: 'sales', title: 'New enquiry', created_at: '2026-10-15T09:00:00Z' }),
    event({ id: 'yest', category: 'orders', title: 'Order status changed', created_at: '2026-10-14T16:00:00Z' }),
    event({ id: 'old', category: 'supplier', title: 'Ogee: 2 jobs changed', created_at: '2026-10-01T12:00:00Z', order_id: 'ord-1' }),
  ];

  it('groups by London day', () => {
    const groups = groupFeed(events, now);
    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday', 'Earlier']);
    expect(groups[0].events[0].id).toBe('today');
  });

  it('filters needs-action and counts unread actions', () => {
    expect(filterFeed(events, 'action').map((row) => row.id)).toEqual(['today']);
    expect(filterFeed(events, 'supplier').map((row) => row.id)).toEqual(['old']);
    expect(unreadActionCount(events, new Set())).toBe(1);
    expect(unreadActionCount(events, new Set(['today']))).toBe(0);
  });

  it('links an order event to the order', () => {
    expect(eventHref(events[2])).toBe('/dashboard/orders?order=ord-1');
  });
});
