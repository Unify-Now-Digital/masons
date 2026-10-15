import { TERMINAL, type Stage } from '@/shared/work/stages';
import type { Lane, WorkItem } from '@/shared/work/types';

export type LaneMark = 'done' | 'us' | 'them' | 'idle';

export interface LaneCell { lane: Lane; mark: LaneMark; stage: Stage | null; item: WorkItem | null }

/** Spec C.2's four cells. CS (Decision 5) can be added by passing `lanes`. */
export const DEFAULT_STRIP_LANES: Lane[] = ['sales', 'permit', 'proof', 'payment'];

/** One cell per lane: an open item gives ●/○, a terminal stage ✓, anything else –. */
export function laneCells(items: WorkItem[], stages: Partial<Record<Lane, Stage>> = {}, lanes: Lane[] = DEFAULT_STRIP_LANES): LaneCell[] {
  return lanes.map((lane) => {
    const item = items.find((i) => i.lane === lane) ?? null;
    if (item) return { lane, item, stage: item.stage, mark: item.blockedBy === 'them' ? 'them' : 'us' };
    const stage = stages[lane] ?? null;
    return { lane, item: null, stage, mark: stage && TERMINAL[lane].includes(stage) ? 'done' : 'idle' };
  });
}

