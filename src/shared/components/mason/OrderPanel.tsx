import React from 'react';
import { cn } from '@/shared/lib/utils';
import type { TrackStep } from '@/shared/lib/orderPanel';
import { StatusSymbol } from './StatusSymbol';

/** 3-step progress track (Stone · Lettering · Install) (✓ ◐ ! ○ ?) with a word under each stage. */
export const ProgressTrack: React.FC<{ steps: TrackStep[]; className?: string }> = ({ steps, className }) => (
  <ol className={cn('grid grid-cols-3 relative', className)} aria-label="Progress">
    <span aria-hidden className="absolute left-[16.7%] right-[16.7%] top-[13px] h-px bg-gardens-bdr2" />
    {steps.map((s) => (
      <li key={s.stage} className="relative flex flex-col items-center gap-1 text-center">
        <StatusSymbol state={s.state} stage={s.stage} className="relative z-[1]" />
        <span className={cn('text-[11px] font-semibold', s.state === 'blocked' ? 'text-gardens-sem-red' : 'text-gardens-tx')}>
          {s.stage}
        </span>
        <span className={cn('text-[11px] leading-tight', s.state === 'blocked' ? 'text-gardens-sem-red' : 'text-gardens-txm-aa')}>
          {s.word}
        </span>
      </li>
    ))}
  </ol>
);
