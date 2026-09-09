import { describe, expect, it } from 'vitest';
import { getOrderTimeline } from './orderTimeline';

const today = new Date('2026-09-09T12:00:00.000Z');
const baseOrder = {
  person: { is_customer: true },
  invoice: null,
  order_payments: [],
  deposit_date: null,
  timeline_weeks: 12,
};

describe('getOrderTimeline', () => {
  it('returns null for a non-customer', () => {
    expect(getOrderTimeline({ ...baseOrder, person: { is_customer: false }, deposit_date: '2026-09-01' }, today)).toBeNull();
  });

  it('returns null when no start date exists', () => {
    expect(getOrderTimeline(baseOrder, today)).toBeNull();
  });

  it('uses deposit_date as the primary clock', () => {
    const result = getOrderTimeline({ ...baseOrder, deposit_date: '2026-09-01T12:00:00.000Z' }, today);
    expect(result).toMatchObject({
      source: 'deposit',
      isLegacyFallback: false,
      currentDay: 9,
      totalDays: 84,
      label: 'Day 9 of 84',
    });
  });

  it('prefers deposit_date over Stripe paid_at when both exist', () => {
    const result = getOrderTimeline({
      ...baseOrder,
      deposit_date: '2026-09-01T12:00:00.000Z',
      invoice: { amount_paid: 100, locked_at: null, stripe_invoice_id: 'in_1', paid_at: '2026-08-31T12:00:00.000Z' },
    }, today);

    expect(result).toMatchObject({ source: 'deposit', currentDay: 9, totalDays: 84, label: 'Day 9 of 84' });
  });

  it('falls back to Stripe paid_at when deposit_date is missing', () => {
    const result = getOrderTimeline({
      ...baseOrder,
      invoice: { amount_paid: 100, locked_at: null, stripe_invoice_id: 'in_1', paid_at: '2026-08-31T12:00:00.000Z' },
    }, today);

    expect(result).toMatchObject({ source: 'stripe', currentDay: 10, totalDays: 84, label: 'Day 10 of 84' });
  });

  it('reports days overdue after the target', () => {
    const result = getOrderTimeline({ ...baseOrder, deposit_date: '2026-06-16T12:00:00.000Z' }, today);
    expect(result).toMatchObject({ currentDay: 86, totalDays: 84, daysOverdue: 2, label: '2 days overdue', colour: 'red' });
  });
});
