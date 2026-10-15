import type { NormalizedStatus, SupplierRollup } from '../../../supabase/functions/_shared/supplierStatus';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function londonYear(now: Date): number {
  const year = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric' }).format(now);
  return Number(year);
}

/** Confirmed supplier dates: en-GB `ddd d MMM`, year only when it is not this year. */
export function formatSupplierDate(ymd: string, now = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!match) return ymd;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return ymd;
  const label = `${WEEKDAYS[utc.getUTCDay()]} ${day} ${MONTHS[month - 1]}`;
  return year === londonYear(now) ? label : `${label} ${year}`;
}

/** Last-synced timestamp in London, same date style, with the time. */
export function formatSupplierWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const label = `${get('weekday')} ${get('day')} ${get('month')}`;
  const dated = Number(get('year')) === londonYear(now) ? label : `${label} ${get('year')}`;
  return `${dated}, ${get('hour')}:${get('minute')}`;
}

export function supplierToneClass(tone: NormalizedStatus | 'possible'): string {
  switch (tone) {
    case 'arrived':
      return 'bg-gardens-na-green-lt text-gardens-na-green';
    case 'transit':
      return 'bg-gardens-na-blue-lt text-gardens-na-blue';
    case 'production':
      return 'bg-gardens-na-amber-lt text-gardens-na-amber';
    case 'possible':
      return 'border border-dashed border-gardens-na-amber bg-transparent text-gardens-na-amber';
    default:
      return 'bg-gardens-page text-gardens-txs';
  }
}

export function supplierDataStale(rollup: SupplierRollup, now = Date.now()): boolean {
  if (rollup.kind === 'none') return false;
  if (rollup.stale) return true;
  if (!rollup.syncedAt) return false;
  const then = new Date(rollup.syncedAt).getTime();
  if (Number.isNaN(then)) return false;
  return now - then > 24 * 60 * 60 * 1000;
}
