import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { ActionPill } from '@/shared/components/mason/ActionPill';
import { LANE_LABEL, type Urgency, type Verb, type WorkItem } from '@/shared/work/types';
import { VERB_LABEL } from '@/shared/work/verbs';
import { slaLabel } from '@/shared/work/sla';
import type { NextActionKind } from '@/shared/lib/nextAction';
import { verbIcon } from './verbIcons';
import { formatValue } from './format';

/** 4px urgency bar: overdue red, due amber, waiting blue (slate), ok transparent. */
const BAR: Record<Urgency, string> = {
  overdue: 'bg-gardens-na-red',
  due: 'bg-gardens-na-amber',
  waiting: 'bg-gardens-na-blue',
  ok: 'bg-transparent',
};

const PILL_KIND: Partial<Record<Verb, Exclude<NextActionKind, 'waiting' | 'none'>>> = {
  request_deposit: 'deposit', request_balance: 'balance', record_payment: 'deposit', reconcile: 'deposit',
};

export interface WorkRowProps {
  item: WorkItem;
  selected?: boolean;
  onOpen: (item: WorkItem) => void;
  onAct: (item: WorkItem) => void;
  showLane?: boolean;
  rankNumber?: number;
  /** Injected for tests; defaults to the render time. */
  now?: Date;
  className?: string;
}

/**
 * The only row for actionable work items (Hub, Inbox Priority, Finance Owed, Orders Needs
 * action). Whole row → onOpen (the caller opens the side panel); the pill → onAct.
 */
export const WorkRow: React.FC<WorkRowProps> = ({ item, selected = false, onOpen, onAct, showLane, rankNumber, now, className }) => {
  const value = formatValue(item);
  const sla = slaLabel(item, now ?? new Date());
  const tone = item.urgency === 'overdue' ? 'red' : item.urgency === 'due' ? 'amber' : 'neutral';
  const label = VERB_LABEL[item.verb];
  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={selected}
      data-testid="work-row"
      data-lane={item.lane}
      data-urgency={item.urgency}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(item); }
      }}
      className={cn(
        'group flex min-w-0 cursor-pointer items-stretch gap-3 rounded-md pr-3 text-left',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc/40',
        selected ? 'bg-gardens-acc-lt' : 'hover:bg-gardens-surf2',
        className,
      )}
    >
      <span aria-hidden className={cn('w-1 shrink-0 rounded-l-md', BAR[item.urgency])} data-testid="work-row-bar" />
      {rankNumber != null && (
        <span className="self-center w-5 shrink-0 text-right text-[11px] tabular-nums text-gardens-txm-aa">{rankNumber}</span>
      )}
      <div role="cell" className="min-w-0 flex-1 py-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-head text-[14px] font-semibold text-gardens-tx">{item.title}</span>
          {item.ref && <span className="shrink-0 text-[12px] text-gardens-txs">· {item.ref}</span>}
          <span className={cn('shrink-0 text-[12px] tabular-nums', value.muted ? 'text-gardens-txm-aa' : 'text-gardens-txs')}>· {value.text}</span>
        </div>
        <div className="truncate text-[12px] text-gardens-txs">{item.blocker}</div>
      </div>
      <div role="cell" className="flex shrink-0 flex-col items-end justify-center py-2 text-right">
        <span className="text-[12px] tabular-nums text-gardens-txs" data-testid="work-row-sla">{sla}</span>
        {showLane && <span className="text-[11px] text-gardens-txs">{LANE_LABEL[item.lane]}</span>}
      </div>
      <div role="cell" className="flex shrink-0 items-center">
        <ActionPill
          kind={PILL_KIND[item.verb] ?? 'follow'}
          label={label}
          tone={tone}
          muted={tone === 'neutral'}
          icon={verbIcon(item.verb)}
          className="h-8"
          aria-label={item.draftReady ? `${label} (draft ready)` : label}
          trailing={item.draftReady ? <Sparkles className="h-3.5 w-3.5" aria-hidden data-testid="work-row-draft" /> : undefined}
          onClick={(e) => { e.stopPropagation(); onAct(item); }}
        />
      </div>
    </div>
  );
};
