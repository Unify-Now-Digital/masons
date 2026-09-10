import { describe, expect, it } from 'vitest';
import {
  computeTimelineProgress,
  NO_DEPOSIT_DATE_LABEL,
  TIMELINE_BAR_TONE,
} from './timelineProgress';

/** Fixed clock: 10 Sep 2026, local midday. */
const NOW = new Date(2026, 8, 10, 12, 0, 0);

const active = (result: ReturnType<typeof computeTimelineProgress>) => {
  if (result.state !== 'active') throw new Error(`expected active, got ${result.state}`);
  return result;
};

describe('computeTimelineProgress — acceptance scenarios', () => {
  it('S1: 5 weeks in of 12 → ~42%, not over, "wk 5 of 12"', () => {
    const r = active(
      computeTimelineProgress({ depositDate: '2026-08-06', timelineWeeks: 12, installationDate: null }, NOW)
    );
    expect(r.elapsedWeeks).toBe(5);
    expect(r.plannedWeeks).toBe(12);
    expect(r.percent).toBeCloseTo(41.67, 1);
    expect(r.isOver).toBe(false);
    expect(r.isInstalled).toBe(false);
    expect(r.label).toBe('wk 5 of 12');
  });

  it('S2: 14 weeks in of 12 → 100%, over, "wk 14 of 12"', () => {
    const r = active(
      computeTimelineProgress({ depositDate: '2026-06-04', timelineWeeks: 12, installationDate: null }, NOW)
    );
    expect(r.elapsedWeeks).toBe(14);
    expect(r.percent).toBe(100);
    expect(r.isOver).toBe(true);
    expect(r.label).toBe('wk 14 of 12');
  });

  it('S3: no deposit date → none state with the muted label', () => {
    expect(computeTimelineProgress({ depositDate: null, timelineWeeks: 12, installationDate: null }, NOW)).toEqual({
      state: 'none',
      label: NO_DEPOSIT_DATE_LABEL,
    });
    // UIOrder carries '' for a null deposit_date.
    expect(computeTimelineProgress({ depositDate: '', timelineWeeks: 12, installationDate: null }, NOW).state).toBe(
      'none'
    );
  });

  it('S4: installation date ends the clock and appends "· installed"', () => {
    const r = active(
      computeTimelineProgress(
        { depositDate: '2026-06-04', timelineWeeks: 12, installationDate: '2026-07-16' },
        NOW
      )
    );
    expect(r.elapsedWeeks).toBe(6); // not the 14 weeks to NOW
    expect(r.isInstalled).toBe(true);
    expect(r.isOver).toBe(false);
    expect(r.label).toBe('wk 6 of 12 · installed');
  });

  it('honours a non-default plan ("of 16")', () => {
    const r = active(
      computeTimelineProgress({ depositDate: '2026-08-06', timelineWeeks: 16, installationDate: null }, NOW)
    );
    expect(r.label).toBe('wk 5 of 16');
    expect(r.percent).toBeCloseTo(31.25, 2);
  });
});

describe('computeTimelineProgress — edge cases', () => {
  it('deposit date in the future → elapsed 0, "wk 0 of M", 0%', () => {
    const r = active(
      computeTimelineProgress({ depositDate: '2026-09-20', timelineWeeks: 12, installationDate: null }, NOW)
    );
    expect(r.elapsedWeeks).toBe(0);
    expect(r.percent).toBe(0);
    expect(r.isOver).toBe(false);
    expect(r.label).toBe('wk 0 of 12');
  });

  it.each([null, undefined, 0, -3, Number.NaN])('timeline_weeks %p → treated as 12, no divide by zero', (weeks) => {
    const r = active(
      computeTimelineProgress({ depositDate: '2026-08-06', timelineWeeks: weeks, installationDate: null }, NOW)
    );
    expect(r.plannedWeeks).toBe(12);
    expect(Number.isFinite(r.percent)).toBe(true);
    expect(r.label).toBe('wk 5 of 12');
  });

  it('installation before deposit (bad data) → elapsed clamps at 0', () => {
    const r = active(
      computeTimelineProgress(
        { depositDate: '2026-08-06', timelineWeeks: 12, installationDate: '2026-07-01' },
        NOW
      )
    );
    expect(r.elapsedWeeks).toBe(0);
    expect(r.percent).toBe(0);
    expect(r.isInstalled).toBe(true);
    expect(r.label).toBe('wk 0 of 12 · installed');
  });

  it('elapsed exactly equal to planned → 100% but NOT over', () => {
    const r = active(
      computeTimelineProgress({ depositDate: '2026-06-18', timelineWeeks: 12, installationDate: null }, NOW)
    );
    expect(r.elapsedWeeks).toBe(12);
    expect(r.percent).toBe(100);
    expect(r.isOver).toBe(false);
  });

  it('one week past planned → over', () => {
    const r = active(
      computeTimelineProgress({ depositDate: '2026-06-11', timelineWeeks: 12, installationDate: null }, NOW)
    );
    expect(r.elapsedWeeks).toBe(13);
    expect(r.isOver).toBe(true);
  });

  it('whole days from local midnight: 6 days → wk 0, 7 days → wk 1, regardless of time of day', () => {
    const sixDays = { depositDate: '2026-09-04', timelineWeeks: 12, installationDate: null };
    const sevenDays = { depositDate: '2026-09-03', timelineWeeks: 12, installationDate: null };
    const lateNight = new Date(2026, 8, 10, 23, 59, 59);
    const earlyMorning = new Date(2026, 8, 10, 0, 0, 1);
    expect(active(computeTimelineProgress(sixDays, lateNight)).elapsedWeeks).toBe(0);
    expect(active(computeTimelineProgress(sevenDays, earlyMorning)).elapsedWeeks).toBe(1);
    expect(active(computeTimelineProgress(sevenDays, lateNight)).elapsedWeeks).toBe(1);
  });

  it('accepts an ISO timestamp prefix as the date part', () => {
    const r = active(
      computeTimelineProgress(
        { depositDate: '2026-08-06T00:00:00+00:00', timelineWeeks: 12, installationDate: null },
        NOW
      )
    );
    expect(r.elapsedWeeks).toBe(5);
  });

  it('unparseable deposit date → none (never NaN)', () => {
    expect(
      computeTimelineProgress({ depositDate: 'not a date', timelineWeeks: 12, installationDate: null }, NOW).state
    ).toBe('none');
  });
});

describe('TIMELINE_BAR_TONE', () => {
  it('shares a neutral track; fill is green under plan and red when over', () => {
    expect(TIMELINE_BAR_TONE.under.track).toBe(TIMELINE_BAR_TONE.over.track);
    expect(TIMELINE_BAR_TONE.under.fill).toContain('grn');
    expect(TIMELINE_BAR_TONE.over.fill).toContain('red');
  });
});
