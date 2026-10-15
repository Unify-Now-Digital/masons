import React, { useRef, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/shared/lib/utils';
import {
  stagePresentation,
  type StageInput,
  type StageToneName,
} from '../utils/stageTone';

const TONE_CLASS: Record<StageToneName, string> = {
  done: 'bg-gardens-na-green-lt text-gardens-na-green',
  waiting: 'bg-gardens-na-blue-lt text-gardens-na-blue',
  needs: 'bg-gardens-na-amber-lt text-gardens-na-amber',
  overdue: 'bg-gardens-na-red-lt text-gardens-na-red',
  none: 'border border-dashed border-gardens-bdr2 bg-transparent text-gardens-txs',
};

export function StageHoverCard({
  title,
  rows,
  onOpen,
}: {
  title: string;
  rows: { label: string; value: string }[];
  onOpen: () => void;
}) {
  return (
    <div className="w-64 rounded-lg border border-gardens-bdr bg-gardens-surf p-3 text-[12px] shadow-md">
      <div className="font-semibold text-gardens-tx">{title}</div>
      {rows.length > 0 && (
        <dl className="mt-2 grid grid-cols-[88px_1fr] gap-x-2 gap-y-1">
          {rows.map((row) => (
            <React.Fragment key={row.label}>
              <dt className="text-gardens-txs">{row.label}</dt>
              <dd className="m-0 text-gardens-tx break-words">{row.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      <button type="button" className="mt-2 text-gardens-acc-dk hover:underline" onClick={onOpen}>
        Open in panel →
      </button>
    </div>
  );
}

function canHover(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export const StagePill: React.FC<{
  stage: 'permit' | 'proof' | 'stone';
  order: StageInput;
  now?: Date;
  onOpen: () => void;
}> = ({ stage, order, now, onOpen }) => {
  const view = stagePresentation(order, stage, now);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const title = `${stage === 'permit' ? 'Permit' : stage === 'proof' ? 'Proof' : 'Stone'}: ${view.word}`;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const schedule = () => {
    if (!canHover()) return;
    clearTimer();
    timer.current = setTimeout(() => setOpen(true), 300);
  };
  const close = () => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  const focusOpen = () => {
    if (!canHover()) return;
    clearTimer();
    setOpen(true);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <button
          type="button"
          aria-label={view.aria}
          data-testid={`stage-pill-${stage}`}
          onMouseEnter={schedule}
          onMouseLeave={close}
          onFocus={focusOpen}
          onBlur={close}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className={cn(
            'h-6 w-full rounded-md px-1.5 text-[12px] font-semibold flex items-center gap-1 min-w-0',
            TONE_CLASS[view.tone],
          )}
        >
          <span className="w-3 shrink-0 text-center leading-none" aria-hidden>{view.symbol}</span>
          <span className="truncate">{view.word}</span>
          {view.detail && (
            <span className={cn('ml-auto shrink-0 font-medium tabular-nums opacity-85', view.detailBold && 'font-bold')}>
              {view.detail}
            </span>
          )}
          {stage === 'proof' && (
            <span
              className={cn(
                'ml-auto h-4 px-1 text-[10px] font-head font-semibold rounded inline-flex items-center shrink-0',
                view.inscriptionMissing
                  ? 'border border-dashed border-gardens-na-red text-gardens-na-red'
                  : 'bg-gardens-tx text-white',
              )}
              title={view.inscriptionMissing ? 'No inscription recorded yet' : 'Inscription recorded'}
            >
              Aa
            </span>
          )}
        </button>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={() => { clearTimer(); setOpen(true); }}
          onMouseLeave={close}
          className="z-50 outline-none"
        >
          <StageHoverCard title={title} rows={view.hover} onOpen={() => { setOpen(false); onOpen(); }} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
