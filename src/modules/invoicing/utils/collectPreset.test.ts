import { describe, expect, it } from 'vitest';
import { collectPresetPence } from './collectPreset';

describe('collectPresetPence', () => {
  it('uses the SM deposit (50% memorial + permit) when known', () => {
    expect(collectPresetPence('deposit', 265_500, 265_500, 141_250)).toBe(141_250);
  });
  it('falls back to 50% of the invoice total, capped at the remaining', () => {
    expect(collectPresetPence('deposit', 573_500, 573_500)).toBe(286_750);
    expect(collectPresetPence('deposit', 573_500, 100_000)).toBe(100_000);
  });
  it('pay in full = the whole remaining balance', () => {
    expect(collectPresetPence('full', 573_500, 286_750)).toBe(286_750);
  });
  it('nothing to collect when nothing remains', () => {
    expect(collectPresetPence('full', 573_500, 0)).toBe(0);
  });
});
