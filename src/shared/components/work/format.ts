import type { Stage } from '@/shared/work/stages';
import type { WorkItem } from '@/shared/work/types';

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

/** Review convention: `£2,180`, `est. £2,180` (muted) or `—` (muted). */
export function formatValue(item: Pick<WorkItem, 'value' | 'valueIsEstimate'>): { text: string; muted: boolean } {
  if (item.value == null) return { text: '—', muted: true };
  return item.valueIsEstimate ? { text: `est. ${gbp(item.value)}`, muted: true } : { text: gbp(item.value), muted: false };
}

/** 'changes_requested' → 'Changes requested'. */
export const stageWord = (stage: Stage | null | undefined) =>
  stage ? stage.charAt(0).toUpperCase() + stage.slice(1).replace(/_/g, ' ') : '';
