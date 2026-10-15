import React from 'react';
import { formatQueueDate, isGroupBy, TIMING_CLASS, timingOf, readyMark, type TodayGroupBy, type TodayView } from './queueView';
import { peopleLateCount, personGroups, TASK_MARK_LABEL, TASK_MARKS, taskMark, type PersonRow } from './personRows';
import { RelationIcon, TaskMarkIcon } from './taskMarks';
import type { Lane } from './todayModel';
import { cn } from '@/shared/lib/utils';

const LEGEND: { id: string; label: string; node: React.ReactNode }[] = [
  { id: 'customer', label: 'Customer', node: <RelationIcon customer className="h-[13px] w-[13px]" /> },
  { id: 'enquiry', label: 'Enquiry', node: <RelationIcon customer={false} className="h-[13px] w-[13px]" /> },
  ...TASK_MARKS.map((mark) => ({
    id: mark,
    label: TASK_MARK_LABEL[mark],
    node: <TaskMarkIcon mark={mark} className="h-[13px] w-[13px]" />,
  })),
];

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

  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-gardens-surf2" data-testid="today-queue">
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

      <footer className="grid shrink-0 grid-cols-3 gap-x-2 gap-y-1.5 border-t border-gardens-bdr bg-gardens-surf px-4 py-2.5" aria-label="People and tasks">
        {LEGEND.map((entry) => (
          <span key={entry.id} className="flex min-w-0 items-center gap-1.5 text-[12px] text-gardens-tx">
            {entry.node}
            {entry.label}
          </span>
        ))}
      </footer>
    </section>
  );
};

const QueueRow: React.FC<{
  row: PersonRow;
  selected: boolean;
  onSelect: (row: PersonRow) => void;
}> = ({ row, selected, onSelect }) => {
  const timing = timingOf(row.lead, row.doneVerb);
  const ready = row.done ? null : readyMark(row.lead);
  return (
    <button
      type="button"
      data-testid="today-row"
      data-key={row.key}
      data-tone={row.done ? 'done' : row.lead.bucket === 'fix' ? 'fix' : row.lead.bucket === 'old' ? 'old' : row.lead.bucket === 'today' ? 'today' : row.lead.waitingOn === 'them' ? 'late-them' : 'late-us'}
      data-bucket={row.lead.bucket}
      data-relation={row.customer ? 'customer' : 'enquiry'}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(row)}
      className={cn(
        'grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-[#EEEAE1] px-3.5 py-1.5 text-left min-h-[52px]',
        selected ? 'bg-gardens-acc-lt shadow-[inset_3px_0_0_var(--g-acc)]' : 'hover:bg-gardens-surf',
        row.done && !selected && 'opacity-[0.55]',
      )}
    >
      <span
        data-testid="today-relation"
        title={row.customer ? 'Customer' : 'Enquiry'}
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-gardens-page text-gardens-tx"
      >
        <RelationIcon customer={row.customer} className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-head text-[14.5px] font-semibold text-gardens-tx" title={row.name}>{row.name}</span>
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
          <span className="min-w-0 truncate text-[12px] text-gardens-txs" title={row.lead.short}>{row.lead.short}</span>
        </span>
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
