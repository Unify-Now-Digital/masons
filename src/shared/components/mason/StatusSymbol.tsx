import React from 'react';
import { cn } from '@/shared/lib/utils';

import { STEP_SYMBOL, STEP_WORD, type StepState } from './stepState';

const STYLE: Record<StepState, string> = {
  done: 'bg-gardens-sem-green text-white border-transparent',
  progress: 'bg-gardens-surf text-gardens-sem-amber border-gardens-sem-amber',
  blocked: 'bg-gardens-sem-red text-white border-transparent',
  todo: 'bg-gardens-surf text-gardens-sem-todo border-gardens-sem-todo',
  unknown: 'bg-transparent text-gardens-sem-unk border-gardens-sem-unk border-dashed',
};

export interface StatusSymbolProps {
  state: StepState;
  /** Stage name for the accessible label, e.g. "Permit". */
  stage: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusSymbol: React.FC<StatusSymbolProps> = ({ state, stage, size = 'md', className }) => {
  const label = `${stage}: ${STEP_WORD[state]}`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-state={state}
      className={cn(
        'inline-grid place-items-center rounded-full border-[1.5px] font-bold leading-none flex-none',
        size === 'sm' ? 'h-5 w-5 text-[11px]' : 'h-7 w-7 text-[13px]',
        STYLE[state],
        className,
      )}
    >
      {STEP_SYMBOL[state]}
    </span>
  );
};

/** Legend: Done / In progress / Blocked on us / Not started / Unknown. */
export const StatusLegend: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('flex flex-wrap items-center gap-3 text-xs text-gardens-txs', className)} aria-label="Progress key">
    {(Object.keys(STEP_SYMBOL) as StepState[]).map((s) => (
      <span key={s} className="inline-flex items-center gap-1">
        <StatusSymbol state={s} stage="Key" size="sm" />
        {STEP_WORD[s].charAt(0).toUpperCase() + STEP_WORD[s].slice(1)}
      </span>
    ))}
  </div>
);
