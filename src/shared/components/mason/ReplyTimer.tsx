import React from 'react';
import { AlarmClock, Clock } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { TimerText } from '@/shared/lib/nextAction';

/** Reply timer in words with an icon ("Overdue · 2d"); colour only reinforces. */
export const ReplyTimer: React.FC<{ timer: TimerText; className?: string }> = ({ timer, className }) => {
  const Icon = timer.tone === 'neutral' ? Clock : AlarmClock;
  return (
    <span
      data-tone={timer.tone}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap',
        timer.tone === 'over' ? 'text-gardens-sem-red' : timer.tone === 'soon' ? 'text-gardens-sem-amber' : 'text-gardens-txs',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {timer.text}
    </span>
  );
};
