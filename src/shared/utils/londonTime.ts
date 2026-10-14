/**
 * Business dates are pinned to Europe/London, whatever the viewer's device time zone.
 * "This month", "this week" and "the day a payment landed" all mean the London calendar.
 */
export const BUSINESS_TZ = 'Europe/London';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
});

export interface LondonParts { year: number; month: number; day: number; hour: number; minute: number; second: number }

export function londonParts(d: Date): LondonParts {
  const p: Record<string, number> = {};
  for (const x of partsFmt.formatToParts(d)) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour! % 24, minute: p.minute!, second: p.second! };
}

/** 'YYYY-MM-DD' of the London calendar day containing instant d. */
export function londonDayKey(d: Date): string {
  const p = londonParts(d);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** London UTC offset (ms) at instant d: +1h in BST, 0 in GMT. */
function londonOffsetMs(d: Date): number {
  const p = londonParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** The instant of 00:00 London time on the given London calendar date (month is 1-based). */
export function londonMidnight(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day);
  // Offset at the guess, re-checked once to settle across a DST change.
  let t = guess - londonOffsetMs(new Date(guess));
  t = guess - londonOffsetMs(new Date(t));
  return new Date(t);
}

/** First instant of the London month containing `now`. */
export function londonMonthStart(now: Date = new Date()): Date {
  const p = londonParts(now);
  return londonMidnight(p.year, p.month, 1);
}

/** First instant of the next London month after the one containing `now`. */
export function londonNextMonthStart(now: Date = new Date()): Date {
  const p = londonParts(now);
  return p.month === 12 ? londonMidnight(p.year + 1, 1, 1) : londonMidnight(p.year, p.month + 1, 1);
}

/** Monday 00:00 London of the week containing `now`. */
export function londonWeekStart(now: Date = new Date()): Date {
  const p = londonParts(now);
  const dow = (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day - dow));
  return londonMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

/** 'YYYY-MM-DD' London dates for the current month: [first, last]. */
export function londonMonthRange(now: Date = new Date()): { from: string; to: string } {
  const p = londonParts(now);
  const last = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
  const mm = String(p.month).padStart(2, '0');
  return { from: `${p.year}-${mm}-01`, to: `${p.year}-${mm}-${String(last).padStart(2, '0')}` };
}
