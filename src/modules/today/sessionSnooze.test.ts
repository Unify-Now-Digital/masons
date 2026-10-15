import { describe, expect, it } from 'vitest';
import { isHiddenUntil, untilTomorrow } from './sessionSnooze';

describe('session snooze', () => {
  it('hides a row until the next local midnight', () => {
    const now = new Date(2026, 9, 15, 18, 30, 0);
    const until = untilTomorrow(now);
    expect(isHiddenUntil(until, now)).toBe(true);
    expect(isHiddenUntil(until, new Date(2026, 9, 16, 0, 0, 0))).toBe(false);
    expect(isHiddenUntil(undefined, now)).toBe(false);
  });
});
