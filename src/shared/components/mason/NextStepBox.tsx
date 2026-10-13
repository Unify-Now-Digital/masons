import React from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { NextAction } from '@/shared/lib/nextAction';

export interface NextStepBoxProps {
  action: NextAction;
  /** Optional one-line summary under the reason. */
  summary?: React.ReactNode;
  /** The one primary or the outlined action button, supplied by the screen. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Neutral next-step box (v7): only the reason line carries red (overdue/blocked) or
 * amber (due soon/waiting). Shared component; placement in the drawer / conversation
 * is HELD pending the next mockups.
 */
export const NextStepBox: React.FC<NextStepBoxProps> = ({ action, summary, children, className }) => {
  if (action.kind === 'none') return null;
  const Icon = action.tone === 'neutral' ? Clock : AlertCircle;
  return (
    <section
      aria-label="Next step"
      data-kind={action.kind}
      className={cn('rounded-[10px] border border-gardens-bdr2 bg-gardens-surf p-3 flex flex-col gap-2', className)}
    >
      <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa flex items-center gap-2">
        Next step
        {action.kind !== 'waiting' && (
          <span className="normal-case tracking-normal text-xs font-bold">· {action.label}</span>
        )}
      </div>
      <div
        data-tone={action.tone}
        className={cn(
          'flex items-center gap-2 font-semibold text-sm',
          action.tone === 'red' ? 'text-gardens-sem-red' : action.tone === 'amber' ? 'text-gardens-sem-amber' : 'text-gardens-tx',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {action.reason}
      </div>
      {summary && <div className="text-[13px] text-gardens-txs">{summary}</div>}
      {children}
    </section>
  );
};
