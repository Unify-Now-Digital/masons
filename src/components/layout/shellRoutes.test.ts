import { describe, expect, it } from 'vitest';
import { aiPromptsFor, DEFAULT_AI_PROMPTS, formatBadgeCount, shellSegment, splitRailItems, titleFor } from './shellRoutes';

const items = [
  { to: '/dashboard/hub' },
  { to: '/dashboard/orders' },
  { to: '/dashboard/finance' },
  { to: '/dashboard/reporting', requiresFinancials: true },
  { to: '/dashboard/pipeline', hidden: true },
  { to: '/dashboard/inbox' },
  { to: '/dashboard/inquiries' },
  { to: '/dashboard/customers' },
];

describe('splitRailItems', () => {
  it('puts Inbox, Orders, Pipeline, Finance first in that order', () => {
    const { primary } = splitRailItems(items, true);
    expect(primary.map((i) => i.to)).toEqual([
      '/dashboard/inbox', '/dashboard/orders', '/dashboard/inquiries', '/dashboard/finance',
    ]);
  });
  it('puts the rest under More, keeping hidden and financial rules', () => {
    expect(splitRailItems(items, true).more.map((i) => i.to)).toEqual([
      '/dashboard/hub', '/dashboard/reporting', '/dashboard/customers',
    ]);
    expect(splitRailItems(items, false).more.map((i) => i.to)).toEqual([
      '/dashboard/hub', '/dashboard/customers',
    ]);
  });
});

describe('shell route helpers', () => {
  it('derives segment and title', () => {
    expect(shellSegment('/dashboard/orders')).toBe('orders');
    expect(titleFor('orders')).toBe('Orders');
    expect(titleFor('unknown')).toBe('Dashboard');
  });
  it('has prompts per page with a default', () => {
    expect(aiPromptsFor('inbox').length).toBeGreaterThan(0);
    expect(aiPromptsFor('nope')).toEqual(DEFAULT_AI_PROMPTS);
  });
  it('formats the badge count', () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(7)).toBe('7');
    expect(formatBadgeCount(140)).toBe('99+');
  });
});
