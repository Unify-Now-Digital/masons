import React from 'react';
import { cn } from '@/shared/lib/utils';
import { LANE_LABEL, type Lane, type WorkItem } from '@/shared/work/types';
import type { Stage } from '@/shared/work/stages';
import { laneCells, type LaneCell, type LaneMark } from './laneCells';
import { stageWord } from './format';

const GLYPH: Record<LaneMark, string> = { done: '✓', us: '●', them: '○', idle: '–' };

function markClass(c: LaneCell): string {
  if (c.mark === 'done') return 'text-gardens-na-green';
  if (c.mark === 'them') return 'text-gardens-na-blue';
  if (c.mark === 'idle') return 'text-gardens-txm-aa';
  if (c.item?.urgency === 'overdue') return 'text-gardens-na-red';
  if (c.item?.urgency === 'due') return 'text-gardens-na-amber';
  return 'text-gardens-tx';
}

const MARK_WORD: Record<LaneMark, string> = { done: 'done', us: 'our move', them: 'waiting on them', idle: 'not started' };

export interface LaneStripProps {
  /** This order's open work items (any lanes). */
  items: WorkItem[];
  /** Stage per lane when there is no open item (so terminal lanes can show ✓). */
  stages?: Partial<Record<Lane, Stage>>;
  lanes?: Lane[];
  size?: 'compact' | 'full';
  onLane?: (lane: Lane) => void;
  className?: string;
}

export const LaneStrip: React.FC<LaneStripProps> = ({ items, stages, lanes, size = 'full', onLane, className }) => {
  const cells = laneCells(items, stages, lanes);
  const compact = size === 'compact';
  return (
    <div
      data-testid="lane-strip"
      data-size={size}
      className={cn('inline-flex min-w-0 items-stretch', compact ? 'h-6 gap-1' : 'h-11 w-full gap-1 rounded-lg border border-gardens-bdr bg-gardens-surf p-1', className)}
    >
      {cells.map((c) => {
        const tip = `${LANE_LABEL[c.lane]}: ${c.stage ? stageWord(c.stage) : 'not started'} · ${MARK_WORD[c.mark]}`;
        return (
          <button
            key={c.lane}
            type="button"
            data-lane={c.lane}
            data-mark={c.mark}
            title={tip}
            aria-label={tip}
            onClick={(e) => { e.stopPropagation(); onLane?.(c.lane); }}
            className={cn(
              'flex min-w-0 items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc/40 hover:bg-gardens-surf2',
              compact ? 'w-6 justify-center' : 'flex-1 flex-col items-start justify-center px-2',
            )}
          >
            {compact ? (
              <span aria-hidden className={cn('text-[12px] leading-none', markClass(c))}>{GLYPH[c.mark]}</span>
            ) : (
              <>
                <span className="text-[11px] leading-tight text-gardens-txs">{LANE_LABEL[c.lane]}</span>
                <span className="flex min-w-0 items-center gap-1 text-[12px] leading-tight text-gardens-tx">
                  <span aria-hidden className={markClass(c)}>{GLYPH[c.mark]}</span>
                  <span className="truncate">{c.stage ? stageWord(c.stage) : '—'}</span>
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
};
