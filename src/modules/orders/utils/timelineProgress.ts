/**
 * Order timeline progress: weeks elapsed since the deposit date against the
 * planned `timeline_weeks`. Pure; the caller supplies `now`.
 *
 * Dates are `date` columns ('YYYY-MM-DD'); days are counted between local
 * midnights and weeks = floor(days / 7). Elapsed ends at `installation_date`
 * when present, else at `now`. Never divides by zero: planned < 1 or missing → 12.
 */

export interface TimelineInput {
  depositDate: string | null | undefined;
  timelineWeeks: number | null | undefined;
  installationDate: string | null | undefined;
}

export type TimelineProgress =
  | { state: 'none'; label: string }
  | {
      state: 'active';
      elapsedWeeks: number;
      plannedWeeks: number;
      percent: number;
      isOver: boolean;
      isInstalled: boolean;
      label: string;
    };

export const DEFAULT_TIMELINE_WEEKS = 12;
export const NO_DEPOSIT_DATE_LABEL = 'No deposit date';

/** Bar tones for PaymentProgressBar: neutral track; green fill under plan, red fill when over. */
export const TIMELINE_BAR_TONE = {
  under: { track: 'var(--g-bdr)', fill: 'var(--g-grn-dk)' },
  over: { track: 'var(--g-bdr)', fill: 'var(--g-red-dk)' },
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Local midnight for a 'YYYY-MM-DD' (or ISO-prefixed) string; null when unparseable/blank. */
function toLocalMidnight(value: string | null | undefined): Date | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (trimmed === '') return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function normalisePlannedWeeks(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return DEFAULT_TIMELINE_WEEKS;
  return Math.floor(value);
}

export function computeTimelineProgress(input: TimelineInput, now: Date): TimelineProgress {
  const start = toLocalMidnight(input.depositDate);
  if (!start) return { state: 'none', label: NO_DEPOSIT_DATE_LABEL };

  const installed = toLocalMidnight(input.installationDate);
  const end = installed ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Math.round absorbs the DST hour so a whole-day span never reads as 0.96 days.
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY));
  const elapsedWeeks = Math.floor(days / 7);
  const plannedWeeks = normalisePlannedWeeks(input.timelineWeeks);
  const percent = Math.min(100, Math.max(0, (elapsedWeeks / plannedWeeks) * 100));
  const isOver = elapsedWeeks > plannedWeeks;
  const isInstalled = installed !== null;

  return {
    state: 'active',
    elapsedWeeks,
    plannedWeeks,
    percent,
    isOver,
    isInstalled,
    label: `wk ${elapsedWeeks} of ${plannedWeeks}${isInstalled ? ' · installed' : ''}`,
  };
}
