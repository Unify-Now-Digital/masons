/**
 * One queue row per person. Tasks stay in rank order; the row's urgency is the
 * most urgent task that is not done yet.
 */
import type { DoneMap } from './sessionDone';
import { compareRank, LANES, rankToday, type Bucket, type Lane, type TodayItem } from './todayModel';
import type { TodayGroupBy } from './queueView';

export type TaskMark = 'message' | 'order' | 'proof' | 'permit' | 'payment';

export const TASK_MARKS: readonly TaskMark[] = ['message', 'order', 'proof', 'permit', 'payment'];

export const TASK_MARK_LABEL: Record<TaskMark, string> = {
  message: 'Message',
  order: 'Order update',
  proof: 'Proof',
  permit: 'Permit',
  payment: 'Payment',
};

export function taskMark(item: Pick<TodayItem, 'lane' | 'orderId'>): TaskMark {
  if (item.lane === 'Proofs') return 'proof';
  if (item.lane === 'Permits') return 'permit';
  if (item.lane === 'Finance') return 'payment';
  if (item.orderId || item.lane === 'CS') return 'order';
  return 'message';
}

export interface PersonRow {
  key: string;
  personId: string | null;
  name: string;
  /** Has an order. Otherwise the person is still an enquiry. */
  customer: boolean;
  /** Ledger row with no person and no order, such as invoices void in Stripe. */
  system: boolean;
  /** Unfinished tasks first, each group in rank order. */
  tasks: TodayItem[];
  lead: TodayItem;
  done: boolean;
  doneVerb?: string;
}

const DOT: Record<Bucket, string> = {
  late: 'bg-gardens-na-red',
  today: 'bg-[#C08A2E]',
  fix: 'bg-[#C08A2E]',
  old: 'bg-gardens-txm',
};

const URGENCY: { id: Bucket; title: string }[] = [
  { id: 'late', title: 'Late' },
  { id: 'today', title: 'Due today' },
  { id: 'fix', title: 'Records to fix' },
  { id: 'old', title: 'Long overdue · call' },
];

function rowKey(item: TodayItem): string {
  return item.personId ?? `anon:${item.key}`;
}

/** One money chase per person. A second "Wrote … waiting on us" row is the same person twice. */
function oneChase(tasks: TodayItem[]): TodayItem[] {
  const chase = tasks.some((task) => /chase deposit|deposit unpaid|deposit due/i.test(`${task.verb} ${task.why}`));
  if (!chase) return tasks;
  const kept = tasks.filter((task) => !/wrote\b|waiting on us/i.test(task.why));
  const deposit = kept.filter((task) => /deposit/i.test(`${task.verb} ${task.why}`));
  const rest = kept.filter((task) => !deposit.includes(task));
  return deposit.length ? [deposit[0], ...rest] : kept;
}

function makeRow(key: string, tasks: TodayItem[], now: number, done: DoneMap): PersonRow {
  const ranked = rankToday(oneChase(tasks), now);
  const open = ranked.filter((task) => !done[task.key]);
  const closed = ranked.filter((task) => done[task.key]);
  const allDone = open.length === 0;
  const lead = (allDone ? ranked[0] : open[0]) ?? ranked[0];
  return {
    key,
    personId: lead.personId ?? null,
    name: lead.name,
    customer: ranked.some((task) => !!task.orderId),
    system: ranked.every((task) => !task.personId && !task.orderId),
    tasks: allDone ? ranked : [...open, ...closed],
    lead,
    done: allDone,
    doneVerb: allDone ? done[lead.key] : undefined,
  };
}

export function toPersonRows(items: TodayItem[], now: number, done: DoneMap): PersonRow[] {
  const buckets = new Map<string, TodayItem[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = rowKey(item);
    const list = buckets.get(key);
    if (list) list.push(item);
    else {
      buckets.set(key, [item]);
      order.push(key);
    }
  }
  const rows = order.map((key) => makeRow(key, buckets.get(key) ?? [], now, done));
  const byLead = (a: PersonRow, b: PersonRow) => compareRank(a.lead, b.lead);
  return [...rows.filter((row) => !row.done).sort(byLead), ...rows.filter((row) => row.done).sort(byLead)];
}

/** Tasks past today's cap join the person's row when that person is already listed. */
export function mergeLater(primary: PersonRow[], later: PersonRow[], now: number, done: DoneMap): { rows: PersonRow[]; laterOnly: PersonRow[] } {
  const extra = new Map(later.map((row) => [row.key, row]));
  const seen = new Set(primary.map((row) => row.key));
  const merged = primary.map((row) => {
    const more = extra.get(row.key);
    return more ? makeRow(row.key, [...row.tasks, ...more.tasks], now, done) : row;
  });
  const byLead = (a: PersonRow, b: PersonRow) => compareRank(a.lead, b.lead);
  return {
    rows: [...merged.filter((row) => !row.done).sort(byLead), ...merged.filter((row) => row.done).sort(byLead)],
    laterOnly: later.filter((row) => !seen.has(row.key)),
  };
}

export interface PersonGroup {
  id: string;
  title: string;
  dotClass: string;
  rows: PersonRow[];
}

export function personGroups(rows: PersonRow[], by: TodayGroupBy): PersonGroup[] {
  if (by === 'person') return [{ id: 'people', title: '', dotClass: 'bg-gardens-txm', rows }];
  if (by === 'lane') {
    const lanes: Lane[] = [...LANES];
    return lanes
      .map((lane) => ({ id: lane, title: lane, dotClass: 'bg-gardens-txm', rows: rows.filter((row) => row.lead.lane === lane) }))
      .filter((group) => group.rows.length > 0);
  }
  return URGENCY
    .map((group) => ({
      id: group.id,
      title: group.title,
      dotClass: DOT[group.id],
      rows: rows.filter((row) => row.lead.bucket === group.id),
    }))
    .filter((group) => group.rows.length > 0);
}

/** People whose most urgent open task is late or long overdue. */
export function peopleLateCount(rows: PersonRow[]): number {
  return rows.filter((row) => !row.done && (row.lead.bucket === 'late' || row.lead.bucket === 'old')).length;
}
