/**
 * Today queue presentation (spec 11b). Pure: grouping, chip tone, timing text.
 * The detail pane (11c) and prepared drafts (11d) are not built here.
 */
import { KIND_LABEL, type ActionKind } from './actionKind';
import { groupByPerson, LANES, rankToday, type Bucket, type Lane, type TodayItem } from './todayModel';

export type TodayGroupBy = 'urgency' | 'person' | 'lane';
export type TodayView = 'All' | Lane;
export type ChipTone = 'late-us' | 'late-them' | 'today' | 'fix' | 'old' | 'done';
export type TimingTone = 'late' | 'soon' | 'old' | 'done';

export const GROUP_VALUES: readonly TodayGroupBy[] = ['urgency', 'person', 'lane'];
const groupKey = (org: string) => `mason-today-group:${org}`;
const viewKey = (org: string) => `mason-today-view:${org}`;

export function isGroupBy(v: string | null): v is TodayGroupBy {
  return v === 'urgency' || v === 'person' || v === 'lane';
}

export function readGroup(org: string | null): TodayGroupBy {
  if (!org) return 'urgency';
  try {
    const v = localStorage.getItem(groupKey(org));
    return isGroupBy(v) ? v : 'urgency';
  } catch {
    return 'urgency';
  }
}

export function writeGroup(org: string, group: TodayGroupBy): void {
  try { localStorage.setItem(groupKey(org), group); } catch { /* private mode */ }
}

export function readView(org: string | null): TodayView {
  if (!org) return 'All';
  try {
    const v = localStorage.getItem(viewKey(org));
    if (v === 'All') return 'All';
    return (LANES as readonly string[]).includes(v ?? '') ? v as Lane : 'All';
  } catch {
    return 'All';
  }
}

export function writeView(org: string, view: TodayView): void {
  try { localStorage.setItem(viewKey(org), view); } catch { /* private mode */ }
}

/** Below 1024px the queue is the whole page and a row opens the side panel. */
export function isQueueNarrow(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(max-width: 1023px)').matches;
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

export interface QueueGroup {
  id: string;
  title: string;
  dotClass: string;
  items: TodayItem[];
}

export function queueGroups(items: TodayItem[], by: TodayGroupBy, now: number): QueueGroup[] {
  const ranked = rankToday(items, now);
  if (by === 'lane') {
    const lanes: Lane[] = ['Sales', 'CS', 'Proofs', 'Permits', 'Finance'];
    return lanes
      .map((lane) => ({ id: lane, title: lane, dotClass: 'bg-gardens-txm', items: ranked.filter((i) => i.lane === lane) }))
      .filter((g) => g.items.length > 0);
  }
  if (by === 'person') {
    return groupByPerson(ranked).map((g) => {
      const first = g.items[0];
      return {
        id: g.personId ?? `anon:${first?.key ?? 'none'}`,
        title: first?.name ?? 'No name',
        dotClass: DOT[first?.bucket ?? 'today'],
        items: g.items,
      };
    });
  }
  return URGENCY
    .map((g) => ({ id: g.id, title: g.title, dotClass: DOT[g.id], items: ranked.filter((i) => i.bucket === g.id) }))
    .filter((g) => g.items.length > 0);
}

/** Past the lane limit: the Late bucket, plus Long overdue. Fix rows are records, not late. */
export function lateCount(items: TodayItem[]): number {
  return items.filter((i) => i.bucket === 'late' || i.bucket === 'old').length;
}

export function chipTone(item: TodayItem, done: boolean): ChipTone {
  if (done) return 'done';
  if (item.bucket === 'fix') return 'fix';
  if (item.bucket === 'old') return 'old';
  if (item.bucket === 'today') return 'today';
  return item.waitingOn === 'them' ? 'late-them' : 'late-us';
}

export const CHIP_CLASS: Record<ChipTone, string> = {
  'late-us': 'bg-gardens-na-red-lt text-gardens-na-red',
  'late-them': 'bg-gardens-na-blue-lt text-gardens-na-blue',
  today: 'bg-gardens-na-amber-lt text-gardens-na-amber',
  fix: 'border border-dashed border-[#C08A2E] bg-gardens-surf2 text-gardens-na-amber',
  old: 'bg-gardens-page text-gardens-txs',
  done: 'bg-gardens-na-green-lt text-gardens-na-green',
};

export const TIMING_CLASS: Record<TimingTone, string> = {
  late: 'text-gardens-na-red',
  soon: 'text-gardens-na-amber',
  old: 'text-gardens-txs',
  done: 'text-gardens-na-green',
};

function latenessText(hours: number): string {
  const h = Math.max(0, Math.floor(hours));
  if (h >= 48) return `${Math.max(1, Math.round(h / 24))}d late`;
  return `${h}h late`;
}

export function timingOf(item: TodayItem, doneVerb: string | undefined): { text: string; tone: TimingTone } {
  if (doneVerb) return { text: doneVerb, tone: 'done' };
  if (item.bucket === 'fix') return { text: 'Record', tone: 'soon' };
  const late = item.lateBy;
  if (item.bucket === 'old') return { text: latenessText(late ?? 0), tone: 'old' };
  if (late != null && late > 0) return { text: latenessText(late), tone: 'late' };
  const left = late == null ? 0 : Math.floor(-late);
  if (left >= 1) return { text: `${left}h left`, tone: 'soon' };
  return { text: 'Due today', tone: 'soon' };
}

/** 11d sets `prepared`. Absent until then, so the row stays quiet. */
export function readyMark(item: TodayItem): '✦ Ready' | '✦ Notes ready' | null {
  const prep = (item as TodayItem & { prepared?: { type?: string } | null }).prepared;
  if (!prep) return null;
  return prep.type === 'call' ? '✦ Notes ready' : '✦ Ready';
}

export function chipLabel(item: TodayItem, done: boolean): string {
  return done ? 'Done' : KIND_LABEL[item.kind];
}

export const LEGEND_KINDS: readonly ActionKind[] = ['reply', 'call', 'chase', 'send', 'order', 'fix'];

export function formatQueueDate(now: Date): string {
  return now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
