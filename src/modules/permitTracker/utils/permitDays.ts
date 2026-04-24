import type { PermitOrder, PermitSection } from '../types/permitTracker.types';

/**
 * Calculate calendar days since a given ISO date string.
 */
export function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const then = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get the relevant days count for an order based on its permit status.
 * - 'pending' orders: days since permit_submitted_at
 * - 'form_sent' orders: days since permit_form_sent_at
 * - 'customer_completed': days since permit_submitted_at (or 0 if not yet submitted)
 */
export function getPermitDays(order: PermitOrder): number {
  if (order.permit_status === 'form_sent') {
    return daysSince(order.permit_form_sent_at);
  }
  return daysSince(order.permit_submitted_at);
}

/**
 * Get the day badge color class based on threshold.
 */
export function getDayBadgeColor(days: number): string {
  if (days >= 29) return 'bg-gardens-red-lt text-gardens-red-dk';
  if (days >= 15) return 'bg-gardens-amb-lt text-gardens-amb-dk';
  return 'bg-gardens-grn-lt text-gardens-grn-dk';
}

/**
 * Determine which section an order belongs to in the action queue.
 */
export function getOrderSection(order: PermitOrder): PermitSection {
  // Awaiting customer signature
  if (order.permit_status === 'form_sent') {
    return 'awaiting_customer';
  }

  const days = getPermitDays(order);

  // Action needed: 29+ days or cemetery replied
  if (days >= 29) {
    return 'action_needed';
  }

  // Chase this week: 15-28 days
  if (days >= 15) {
    return 'chase_this_week';
  }

  // On track: 0-14 days
  return 'on_track';
}

/**
 * Group orders by their section, sorted within each section by days descending.
 */
export function groupOrdersBySection(orders: PermitOrder[]): Record<PermitSection, PermitOrder[]> {
  const groups: Record<PermitSection, PermitOrder[]> = {
    action_needed: [],
    chase_this_week: [],
    awaiting_customer: [],
    on_track: [],
  };

  for (const order of orders) {
    const section = getOrderSection(order);
    groups[section].push(order);
  }

  // Sort each section by days descending (most urgent first)
  for (const key of Object.keys(groups) as PermitSection[]) {
    groups[key].sort((a, b) => getPermitDays(b) - getPermitDays(a));
  }

  return groups;
}

/**
 * Format a date for display (e.g. "2 April 2026").
 */
export function formatPermitDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
