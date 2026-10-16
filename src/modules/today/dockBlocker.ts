import type { TodayItem } from './todayModel';

export type DockBlocker = 'permit' | 'stone' | 'invoice' | 'stage';

/** Permit, stone or invoice when that lane is the blocker. Otherwise the job stage. */
export function dockBlockerFor(item: Pick<TodayItem, 'lane' | 'kind'>): DockBlocker {
  if (item.lane === 'Permits') return 'permit';
  if (item.lane === 'Finance') return 'invoice';
  if (item.kind === 'order') return 'stone';
  return 'stage';
}
