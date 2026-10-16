import { ListFilter } from 'lucide-react';
import React, { useState } from 'react';
import { formatQueueDate, isGroupBy, noDraftMark, TIMING_CLASS, timingOf, type TodayGroupBy, type TodayView } from './queueView';
import { peopleLateCount, personGroups, TASK_MARK_LABEL, taskMark, type PersonRow } from './personRows';
import { RelationIcon, SystemIcon, TaskMarkIcon } from './taskMarks';
import type { Lane } from './todayModel';
import { cn } from '@/shared/lib/utils';

const GROUP_LABEL: Record<TodayGroupBy, string> = {
  urgency: 'Urgency',
  person: 'Person',
  lane: 'Lane',
};

export const TodayQueue: React.FC<{
  /** Every lane, for chip counts. `rows` is the filtered list on screen. */
  allRows: PersonRow[];
  rows: PersonRow[];
  later: PersonRow[];
  showLater: boolean;
  onToggleLater: () => void;
  lanes: Lane[];
  view: TodayView;
  onView: (view: TodayView) => void;
  rowsFor: (lane: Lane) => PersonRow[];
  groupBy: TodayGroupBy;
  onGroupBy: (group: TodayGroupBy) => void;
  now: Date;
  selectedKey: string | null;
  onSelect: (row: PersonRow) => void;
  notice?: React.ReactNode;
  loading?: boolean;
  emptyText: string;
}> = ({
  allRows, rows, later, showLater, onToggleLater, lanes, view, onView, rowsFor,
  groupBy, onGroupBy, now, selectedKey, onSelect, notice, loading, emptyText,
}) => {
  const doneN = rows.filter((r) => r.done).length;
  const remaining = rows.length - doneN;
  const total = doneN + remaining;
  const groups = personGroups(rows, groupBy);
  const views: TodayView[] = ['All', ...lanes];
  const [groupOpen, setGroupOpen] = useState(false);

  return (
    <section className="flex min-w-0 max-w-full flex-col overflow-x-hidden bg-white lg:h-full lg:min-h-0 lg:overflow-y-auto" data-testid="today-queue">
      <header className="border-b border-gardens-bdr bg-gardens-surf px-4 pb-2.5 pt-3.5 lg:sticky lg:top-0 lg:z-10">
        <div className="flex items-center gap-2.5">
          <h2 className="m-0 whitespace-nowrap font-head text-[24px] font-semibold leading-none text-gardens-tx" data-testid="today-header">
            {remaining} to do
          </h2>
          <span className="whitespace-nowrap text-[13px] text-gardens-txs" data-testid="today-date">{formatQueueDate(now)}</span>
          <span className="ml-auto whitespace-nowrap text-[12px] font-semibold text-gardens-na-green" data-testid="today-done">
            {doneN} done
          </span>
          <div className="relative">
            <button
              type="button"
              data-testid="today-group"
              aria-label="Group by"
              aria-haspopup="menu"
              aria-expanded={groupOpen}
              title="Group by: Urgency, Person, Lane"
              onClick={() => setGroupOpen((open) => !open)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gardens-bdr bg-white text-gardens-txs"
            >
              <ListFilter className="h-3.5 w-3.5" aria-hidden />
            </button>
            {groupOpen && (
              <div role="menu" data-testid="today-group-menu" className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gardens-bdr bg-white p-1 shadow-md">
                {(['urgency', 'person', 'lane'] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={groupBy === id}
                    data-value={id}
                    onClick={() => { if (isGroupBy(id)) onGroupBy(id); setGroupOpen(false); }}
                    className="flex min-h-9 w-full items-center rounded-md px-2 text-left text-[13px] text-gardens-tx hover:bg-gardens-page"
                  >
                    <span className="w-4">{groupBy === id ? '✓' : ''}</span>
                    {GROUP_LABEL[id]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div
          className="mt-2.5 h-[3px] overflow-hidden rounded-sm bg-[#E9E4D9]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneN}
          aria-label="Done today"
          data-testid="today-progress"
        >
          <div className="h-full bg-gardens-na-green" style={{ width: total ? `${(doneN / total) * 100}%` : '0%' }} />
        </div>
        <div className="mt-2.5 flex gap-0.5 overflow-hidden rounded-lg bg-[#E9E4D9] p-[3px]" role="group" aria-label="Lane" data-testid="today-chips">
          {views.map((id) => {
            const source = id === 'All' ? allRows : rowsFor(id);
            const count = source.length;
            const late = peopleLateCount(source);
            const on = view === id;
            const disabled = id !== 'All' && count === 0;
            return (
              <button
                key={id}
                type="button"
                data-testid={`today-chip-${id}`}
                aria-pressed={on}
                disabled={disabled}
                title={`${count} tasks · ${late} late`}
                onClick={() => onView(id)}
                className={cn(
                  'inline-flex min-w-0 flex-auto items-baseline justify-center gap-1 overflow-hidden rounded-md px-[3px] py-[5px] text-[12.5px]',
                  on ? 'bg-white font-bold text-gardens-tx shadow-sm' : 'bg-transparent font-medium text-gardens-txs',
                  disabled && 'opacity-50',
                )}
              >
                <span className="truncate">{id}</span>
                <span data-testid="today-count" className={cn('font-semibold tabular-nums', late > 0 && 'text-gardens-na-red')}>{count}</span>
              </button>
            );
          })}
        </div>
      </header>

      {notice}
      <div className="min-w-0 overflow-x-hidden" data-testid="today-list">
        {loading ? (
          <p className="m-0 px-4 py-3 text-[13px] text-gardens-txs">Loading today's list…</p>
        ) : rows.length === 0 ? (
          <p className="m-0 px-4 py-3 text-[13px] text-gardens-txs">{emptyText}</p>
        ) : groups.map((g) => (
          <div key={g.id}>
            {g.title ? (
              <div
                className="flex h-8 items-center gap-2 border-b border-[#EEEAE1] bg-[#F7F4EC] px-4"
                data-testid="today-section"
                data-group={g.id}
                data-count={g.rows.length}
              >
                <span className={cn('h-[7px] w-[7px] shrink-0 rounded-full', g.dotClass)} aria-hidden />
                <span className="whitespace-nowrap text-[12px] font-bold uppercase tracking-[.08em] text-gardens-tx">{g.title}</span>
                <span className="text-[12px] tabular-nums text-gardens-txm">{g.rows.length}</span>
              </div>
            ) : null}
            {g.rows.map((row) => (
              <QueueRow key={row.key} row={row} selected={row.key === selectedKey} onSelect={onSelect} />
            ))}
          </div>
        ))}
        {later.length > 0 && (
          <button type="button" className="flex min-h-11 w-full items-center px-4 text-left text-[13px] text-gardens-txs underline" onClick={onToggleLater}>
            {showLater ? 'Hide' : `${later.length} more after today's cap`}
          </button>
        )}
        {showLater && later.map((row) => (
          <QueueRow key={row.key} row={row} selected={row.key === selectedKey} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
};

const QueueRow: React.FC<{
  row: PersonRow;
  selected: boolean;
  onSelect: (row: PersonRow) => void;
}> = ({ row, selected, onSelect }) => {
  const timing = timingOf(row.lead, row.doneVerb);
  const draftNote = row.done ? null : noDraftMark(row.lead);
  return (
    <button
      type="button"
      data-testid="today-row"
      data-key={row.key}
      data-tone={row.done ? 'done' : row.lead.bucket === 'fix' ? 'fix' : row.lead.bucket === 'old' ? 'old' : row.lead.bucket === 'today' ? 'today' : row.lead.waitingOn === 'them' ? 'late-them' : 'late-us'}
      data-bucket={row.lead.bucket}
      data-relation={row.system ? 'system' : row.customer ? 'customer' : 'enquiry'}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(row)}
      className={cn(
        'grid w-full min-h-[50px] grid-cols-[36px_minmax(0,1fr)_6.75rem] items-center gap-x-2 border-b border-[#EEEAE1] py-1.5 pl-3.5 pr-4 text-left',
        selected ? 'bg-[#F4F6FB] shadow-[inset_3px_0_0_var(--g-acc)]' : 'hover:bg-gardens-surf',
        row.done && !selected && 'opacity-[0.55]',
      )}
    >
      <span
        data-testid="today-relation"
        title={row.system ? 'System' : row.customer ? 'Customer' : 'Enquiry'}
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-gardens-page text-gardens-tx"
      >
        {row.system ? <SystemIcon className="h-4 w-4" /> : <RelationIcon customer={row.customer} className="h-4 w-4" />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn('font-head text-[14.5px] font-semibold leading-snug text-gardens-tx', row.system ? 'line-clamp-2 break-words' : 'truncate')} title={row.name}>{row.name}</span>
        <span className="flex min-w-0 items-center gap-1">
          <span className="flex shrink-0 items-center gap-0.5">
            {row.tasks.map((task) => {
              const mark = taskMark(task);
              return (
                <span key={task.key} data-testid="today-task" data-mark={mark} title={TASK_MARK_LABEL[mark]} className="text-gardens-txs">
                  <TaskMarkIcon mark={mark} className="h-3.5 w-3.5" />
                </span>
              );
            })}
          </span>
          <span className="line-clamp-2 min-w-0 break-words text-[12px] leading-4 text-gardens-txs" title={row.lead.short}>{row.lead.short}</span>
        </span>
      </span>
      <span className="flex w-[6.75rem] shrink-0 flex-col items-end gap-0.5 text-right">
        <span className={cn('whitespace-nowrap text-[12px] font-bold tabular-nums', TIMING_CLASS[timing.tone])} data-testid="today-timing">
          {timing.text}
        </span>
        {draftNote && <span className="whitespace-nowrap text-[11px] font-semibold text-gardens-na-amber">{draftNote}</span>}
      </span>
    </button>
  );
};
