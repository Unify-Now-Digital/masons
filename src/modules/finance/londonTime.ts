/** Europe/London day and month bounds. Cash-in "today" follows the workshop, not the browser. */

const LONDON = 'Europe/London';

function parts(ms: number): { year: number; month: number; day: number; hour: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const bag = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { year: Number(bag.year), month: Number(bag.month), day: Number(bag.day), hour: Number(bag.hour) };
}

function offsetMs(utcMs: number): number {
  const p = parts(utcMs);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour) - utcMs;
}

function londonStart(year: number, month: number, day: number): number {
  const guess = Date.UTC(year, month - 1, day);
  return guess - offsetMs(guess);
}

export function londonDayStartMs(ms: number): number {
  const p = parts(ms);
  return londonStart(p.year, p.month, p.day);
}

export function londonNextDayStartMs(ms: number): number {
  const p = parts(ms);
  return londonStart(p.year, p.month, p.day + 1);
}

export function londonMonthStartMs(ms: number): number {
  const p = parts(ms);
  return londonStart(p.year, p.month, 1);
}

/** Noon in Europe/London on a YYYY-MM-DD date, as UTC ISO. Record payment stores this. */
export function londonNoonIso(yyyyMmDd: string): string {
  const [year, month, day] = yyyyMmDd.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, 12, 0, 0);
  return new Date(guess - offsetMs(guess)).toISOString();
}

export function formatLondonDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { timeZone: LONDON, day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatLondonDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    timeZone: LONDON,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
