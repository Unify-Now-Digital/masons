import { Check } from 'lucide-react';
import React from 'react';
import { KIND_ICON, KIND_LABEL } from './actionKind';
import {
  CHIP_CLASS, chipLabel, chipTone, formatQueueDate, isGroupBy, lateCount, LEGEND_KINDS,
  queueGroups, readyMark, TIMING_CLASS, timingOf,
  type TodayGroupBy, type TodayView,
} from './queueView';
import type { DoneMap } from './sessionDone';
import type { Lane, TodayItem } from './todayModel';
import { cn } from '@/shared/lib/utils';

export const TodayQueue: React.FC<{
  /** Every lane, for chip counts. `rows` is the filtered list on screen. */
  allRows: TodayItem[];
  rows: TodayItem[];
  later: TodayItem[];
  showLater: boolean;
  onToggleLater: () => void;
  lanes: Lane[];
  view: TodayView;
  onView: (view: TodayView) => void;
  rowsFor: (lane: Lane) => TodayItem[];
  groupBy: TodayGroupBy;
  onGroupBy: (group: TodayGroupBy) => void;
  now: Date;
  nowMs: number;
  done: DoneMap;
  selectedKey: string | null;
  onSelect: (item: TodayItem) => void;
  notice?: React.ReactNode;
  loading?: boolean;
  emptyText: string;
}> = ({
  allRows, rows, later, showLater, onToggleLater, lanes, view, onView, rowsFor,
  groupBy, onGroupBy, now, nowMs, done, selectedKey, onSelect, notice, loading, emptyText,
}) => {
  const doneN = rows.filter((r) => done[r.key]).length;
  const remaining = rows.length - doneN;
  const total = doneN + remaining;
  const groups = queueGroups(rows, groupBy, nowMs);
  const views: TodayView[] = ['All', ...lanes];

  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-gardens-surf2 lg:col-span-2" data-testid="today-queue">
      <header className="shrink-0 border-b border-gardens-bdr bg-gardens-surf px-3.5 pb-2.5 pt-3 sm:px-4">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h2 className="m-0 whitespace-nowrap font-head text-[24px] font-semibold leading-none text-gardens-tx" data-testid="today-header">
            {remaining} to do
          </h2>
          <span className="whitespace-nowrap text-[13px] text-gardens-txs" data-testid="today-date">{formatQueueDate(now)}</span>
          {doneN > 0 && (
            <span className="ml-auto whitespace-nowrap text-[12px] font-semibold text-gardens-na-green" data-testid="today-done">
              {doneN} done
            </span>
          )}
        </div>
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-sm bg-[#E9E4D9]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneN}
          aria-label="Done today"
          data-testid="today-progress"
        >
          <div className="h-full bg-gardens-na-green" style={{ width: total ? `${(doneN / total) * 100}%` : '0%' }} />
        </div>
        <div className="mt-2 flex flex-col gap-1.5 min-[768px]:flex-row min-[768px]:items-center">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" role="group" aria-label="Lane">
            {views.map((id) => {
              const source = id === 'All' ? allRows : rowsFor(id);
              const count = source.length;
              const late = lateCount(source);
              const on = view === id;
              const disabled = id !== 'All' && count === 0;
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`today-chip-${id}`}
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => onView(id)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium',
                    on ? 'border-gardens-acc bg-gardens-acc-lt text-gardens-acc-dk' : 'border-gardens-bdr bg-gardens-surf2 text-gardens-tx',
                    disabled && 'opacity-50',
                  )}
                >
                  {id}
                  <span className="tabular-nums">{count}</span>
                  {late > 0 && (
                    <span className="text-[12px] font-semibold text-gardens-na-red" data-testid="today-late">· {late} late</span>
                  )}
                </button>
              );
            })}
          </div>
          <label className="shrink-0 min-[768px]:ml-auto">
            <span className="sr-only">Group by</span>
            <select
              value={groupBy}
              data-testid="today-group"
              onChange={(e) => { if (isGroupBy(e.target.value)) onGroupBy(e.target.value); }}
              className="h-11 min-h-11 w-full rounded-lg border border-gardens-bdr bg-gardens-surf2 px-2 text-[13px] text-gardens-tx min-[768px]:w-auto"
            >
              <option value="urgency">Group: Urgency</option>
              <option value="person">Group: Person</option>
              <option value="lane">Group: Lane</option>
            </select>
          </label>
        </div>
      </header>

      {notice}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="m-0 px-4 py-3 text-[13px] text-gardens-txs">Loading today's list…</p>
        ) : rows.length === 0 ? (
          <p className="m-0 px-4 py-3 text-[13px] text-gardens-txs">{emptyText}</p>
        ) : groups.map((g) => (
          <div key={g.id}>
            <div
              className="flex h-8 items-center gap-2 border-b border-[#EEEAE1] bg-[#F7F4EC] px-4"
              data-testid="today-section"
              data-group={g.id}
              data-count={g.items.length}
            >
              <span className={cn('h-[7px] w-[7px] shrink-0 rounded-full', g.dotClass)} aria-hidden />
              <span className="whitespace-nowrap text-[12px] font-bold uppercase tracking-[.08em] text-gardens-tx">{g.title}</span>
              <span className="text-[12px] tabular-nums text-gardens-txm">{g.items.length}</span>
            </div>
            {g.items.map((item) => (
              <QueueRow key={item.key} item={item} doneVerb={done[item.key]} selected={item.key === selectedKey} onSelect={onSelect} />
            ))}
          </div>
        ))}
        {later.length > 0 && (
          <button type="button" className="flex min-h-11 w-full items-center px-4 text-left text-[13px] text-gardens-txs underline" onClick={onToggleLater}>
            {showLater ? 'Hide' : `${later.length} more after today's cap`}
          </button>
        )}
        {showLater && later.map((item) => (
          <QueueRow key={item.key} item={item} doneVerb={done[item.key]} selected={item.key === selectedKey} onSelect={onSelect} />
        ))}
      </div>

      <footer className="grid shrink-0 grid-cols-3 gap-x-2 gap-y-1.5 border-t border-gardens-bdr bg-gardens-surf px-4 py-2.5" aria-label="Action kinds">
        {LEGEND_KINDS.map((kind) => {
          const Icon = KIND_ICON[kind];
          return (
            <span key={kind} className="flex min-w-0 items-center gap-1.5 text-[12px] text-gardens-tx">
              <Icon className="h-[13px] w-[13px] shrink-0" strokeWidth={2} aria-hidden />
              {KIND_LABEL[kind]}
            </span>
          );
        })}
      </footer>
    </section>
  );
};

const QueueRow: React.FC<{
  item: TodayItem;
  doneVerb?: string;
  selected: boolean;
  onSelect: (item: TodayItem) => void;
}> = ({ item, doneVerb, selected, onSelect }) => {
  const done = !!doneVerb;
  const tone = chipTone(item, done);
  const timing = timingOf(item, doneVerb);
  const ready = done ? null : readyMark(item);
  const Icon = done ? Check : KIND_ICON[item.kind];
  return (
    <button
      type="button"
      data-testid="today-row"
      data-key={item.key}
      data-tone={tone}
      data-bucket={item.bucket}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(item)}
      className={cn(
        'grid w-full grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-[#EEEAE1] px-3.5 py-1.5 text-left min-h-[52px]',
        selected ? 'bg-[#F4F6FB] shadow-[inset_3px_0_0_var(--g-acc)]' : 'hover:bg-[#FBF9F4]',
        done && !selected && 'opacity-[0.55]',
      )}
    >
      <span
        data-testid="today-chip"
        className={cn(
          'inline-flex h-7 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md px-2 text-[12.5px] font-bold',
          CHIP_CLASS[tone],
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
        {chipLabel(item, done)}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-head text-[14.5px] font-semibold text-gardens-tx" title={item.name}>{item.name}</span>
        <span className="truncate text-[12.5px] text-gardens-txs" title={item.short}>{item.short}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className={cn('whitespace-nowrap text-[12px] font-bold tabular-nums', TIMING_CLASS[timing.tone])} data-testid="today-timing">
          {timing.text}
        </span>
        {ready && <span className="whitespace-nowrap text-[12px] font-semibold text-gardens-acc">{ready}</span>}
      </span>
    </button>
  );
};
