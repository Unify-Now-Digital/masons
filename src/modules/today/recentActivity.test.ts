import { describe, expect, it } from 'vitest';
import { recentActivity, storedOpenAt } from './recentActivity';

const NOW = new Date('2026-10-16T12:00:00Z');

describe('recentActivity', () => {
  it('orders events newest first and keeps four', () => {
    const events = recentActivity({
      messages: [{
        id: 'm1', at: '2026-10-01T10:00:00Z', direction: 'inbound', channel: 'email',
        body: 'Can you send the price?', conversationId: 'c1',
      }],
      quotes: [{ id: 'q1', at: '2026-10-03T10:00:00Z', number: 12, sentAt: '2026-10-04T10:00:00Z' }],
      invoices: [{ id: 'i1', at: '2026-10-02T10:00:00Z', number: 'INV-1', paidAt: '2026-10-05T10:00:00Z' }],
      orderEvents: [{ id: 'e1', at: '2026-10-06T10:00:00Z', summary: 'Stone ordered', orderId: 'o1' }],
      proofs: [{ id: 'p1', at: '2026-10-07T10:00:00Z', orderId: 'o1' }],
    }, NOW);

    expect(events.map((event) => event.id)).toEqual(['p1', 'e1', 'i1:paid', 'q1:sent']);
    expect(events).toHaveLength(4);
    expect(events.some((event) => /open/i.test(event.title))).toBe(false);
  });

  it('never fabricates an email open', () => {
    expect(storedOpenAt(null)).toBeNull();
    expect(storedOpenAt({})).toBeNull();
    expect(storedOpenAt({ opened_at: '  ' })).toBeNull();
    const events = recentActivity({
      messages: [{
        id: 'm1', at: '2026-10-08T09:00:00Z', direction: 'outbound', channel: 'email',
        body: 'Here is the quote.', conversationId: 'c1', meta: { subject: 'Quote' },
      }],
    }, NOW);
    expect(events.map((event) => event.title)).toEqual(['We wrote']);
    expect(events[0]?.quote).toBe('Here is the quote.');
  });

  it('includes an open only when tracking stored a time, and sorts by that time', () => {
    const events = recentActivity({
      messages: [{
        id: 'm1', at: '2026-10-01T09:00:00Z', direction: 'outbound', channel: 'email',
        body: 'Proof attached.', conversationId: 'c9', meta: { opened_at: '2026-10-09T15:00:00Z' },
      }],
    }, NOW);
    expect(events.map((event) => event.title)).toEqual(['Email opened', 'We wrote']);
    expect(events[0]?.at).toBe('2026-10-09T15:00:00Z');
    expect(storedOpenAt({ openedAt: '2026-10-09T15:00:00Z' })).toBe('2026-10-09T15:00:00Z');
  });
});
