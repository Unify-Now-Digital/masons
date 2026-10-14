/**
 * Reply SLAs per lane, approved by Arin 15 Oct 2026:
 * 24h Sales and Customer Service, 48h Permits, 72h Finance.
 * Single source for the Today view and the inbox bucket timers.
 */
export const REPLY_SLA_HOURS = { Sales: 24, CS: 24, Permits: 48, Finance: 72 } as const;
export type SlaLane = keyof typeof REPLY_SLA_HOURS;
export const HOUR_MS = 60 * 60 * 1000;
export function replySlaHours(lane: string): number {
  return (REPLY_SLA_HOURS as Record<string, number>)[lane] ?? REPLY_SLA_HOURS.Sales;
}
