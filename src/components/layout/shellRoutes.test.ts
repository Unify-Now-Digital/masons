import { describe, expect, it } from 'vitest';
import { formatBadgeCount, searchShortcutLabel, showsPaneTitle, shellSegment, splitRailItems, titleFor } from './shellRoutes';

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
  it('skips the shell title where the page has its own heading', () => {
    expect(showsPaneTitle('orders')).toBe(false);
    expect(showsPaneTitle('settings')).toBe(false);
    expect(showsPaneTitle('inbox')).toBe(true);
    expect(showsPaneTitle('finance')).toBe(true);
  });
  it('labels the search shortcut per platform', () => {
    expect(searchShortcutLabel('MacIntel')).toBe('⌘K');
    expect(searchShortcutLabel('Win32')).toBe('Ctrl K');
    expect(searchShortcutLabel(undefined)).toBe('Ctrl K');
  });
  it('formats the badge count', () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(7)).toBe('7');
    expect(formatBadgeCount(140)).toBe('99+');
  });
});
