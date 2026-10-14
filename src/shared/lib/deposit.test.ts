import { describe, expect, it } from 'vitest';
import { depositPence, depositPoundsFromTotal } from './deposit';

describe('deposit = 50% memorial + 100% permit', () => {
  it('matches the SM examples', () => {
    // Sharena #280: 50% x £2,485 + £170 = £1,412.50
    expect(depositPence(248_500, 17_000)).toBe(141_250);
    // Amponsah #273: total £4,602.20 incl. £376 permit -> £2,489.10
    expect(depositPoundsFromTotal(4602.2, 376)).toBe(2489.1);
  });
  it('no permit -> plain 50%', () => {
    expect(depositPoundsFromTotal(1000, 0)).toBe(500);
  });
});
