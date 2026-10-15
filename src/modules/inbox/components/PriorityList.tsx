import React, { useEffect, useRef } from 'react';
import { ActionPill, WaitingChip } from '@/shared/components/mason/ActionPill';
import type { NextActionKind, NextActionTone } from '@/shared/lib/nextAction';
import { cn } from '@/shared/lib/utils';
import { money } from './priorityListHelpers';

export interface PriorityRow {
  key: string;
  personId: string;
  conversationId: string | null;
  name: string;
  value: number | null;
  valueIsGuess?: boolean;
  stage: string;
  action: { kind: Exclude<NextActionKind, 'none'>; label: string; tone: NextActionTone };
  why: string;
  since: string | null;
}

const ageLabel = (iso: string | null) => {
  if (!iso) return '';
  const d = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
  return d < 1 ? 'today' : `${d}d`;
};
export const PriorityPill: React.FC<{ action: PriorityRow['action']; solid?: boolean; compact?: boolean }> = ({ action, solid, compact }) => {
  const c = compact ? 'h-5 pl-1 pr-2 text-[11px] [&_svg]:h-3 [&_svg]:w-3' : undefined;
  return action.kind === 'waiting'
    ? <WaitingChip label={action.label} className={c} />
    : <ActionPill kind={action.kind} label={action.label} tone={action.tone} solid={solid} className={c} />;
};

const toneOf = (a: PriorityRow['action']) => (a.kind === 'waiting' ? 'blue' : a.tone === 'red' ? 'red' : a.tone === 'amber' ? 'amber' : 'none');
const BAR = { red: 'bg-gardens-na-red', amber: 'bg-gardens-na-amber', blue: 'bg-gardens-na-blue', none: 'bg-transparent' } as const;

/** Ranked Priority list (Enquiries or Customers scope). Read-only; selection only.
 *  Row style C (see InboxRow). */
export const PriorityList: React.FC<{
  rows: PriorityRow[];
  selectedKey: string | null;
  doneKeys: Set<string>;
  onSelect: (row: PriorityRow) => void;
  isLoading?: boolean;
  emptyText: string;
}> = ({ rows, selectedKey, doneKeys, onSelect, isLoading, emptyText }) => {
  const selRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { selRef.current?.scrollIntoView({ block: 'nearest' }); }, [selectedKey]);
  if (isLoading) return <p className="text-xs text-gardens-txs py-3 px-3 m-0">Ranking…</p>;
  if (rows.length === 0) return <p className="text-xs text-gardens-txs py-3 px-3 m-0">{emptyText}</p>;
  return (
    <div
      className="divide-y divide-gardens-bdr"
      data-testid="priority-list"
    >
      {rows.map((r, i) => {
        const sel = r.key === selectedKey;
        const done = doneKeys.has(r.key);
        const tone = toneOf(r.action);
        const urgent = tone === 'red';
        return (
          <div
            key={r.key}
            ref={sel ? selRef : undefined}
            role="button"
            tabIndex={0}
            data-testid="priority-row"
            aria-current={sel ? 'true' : undefined}
            onClick={() => onSelect(r)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } }}
            className={cn(
              'relative flex items-start gap-3 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc/30',
              done && 'opacity-50',
              'pl-4 pr-3 py-2',
              sel ? 'bg-gardens-acc-lt' : 'bg-gardens-surf2 hover:bg-gardens-page',
            )}
          >
            <span className={cn('absolute left-0 top-0 bottom-0 w-1', BAR[tone])} aria-hidden />
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-[11px] tabular-nums text-gardens-txm-aa">{i + 1}</span>
                <span className={cn('font-head text-[14px] leading-5 truncate min-w-0 text-gardens-tx', urgent && !done ? 'font-bold' : 'font-medium')} title={r.name}>{r.name}</span>
                <span className="ml-auto shrink-0 text-[12px] tabular-nums text-gardens-tx" title={r.valueIsGuess ? 'Estimated value (no quote found)' : undefined}>
                  {r.value == null ? '£?' : money(r.value)}{r.valueIsGuess ? '?' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] text-gardens-txs truncate">{r.stage}</span>
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-gardens-txs">{ageLabel(r.since)}</span>
                <span className="shrink-0"><PriorityPill action={r.action} compact /></span>
              </div>
              <div className="text-[12px] text-gardens-txs truncate" title={r.why}>{done ? 'Done for now' : r.why}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
