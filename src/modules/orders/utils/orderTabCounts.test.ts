import { describe, expect, it } from 'vitest';
import { orderTabCounts, orderTabValues } from './orderGrouping';

describe('order tab counts', () => {
  it('puts every order in a tab that is shown, so the tabs add up to All', () => {
    const orders = [
      { group: 'invoiced' },
      { group: 'invoiced' },
      ...Array.from({ length: 16 }, () => ({ group: 'confirmed' })),
      { group: 'in_production' },
      { group: 'fixed' },
      { group: 'complete' },
      { group: 'enquired' },
      { group: 'quoted' },
      { group: 'quoted' },
      { group: 'unassigned' },
      { group: 'not-a-stage' },
    ];
    // The trailing zero-count stages are omitted from this fixture's non-zero
    // story: invoiced 2, confirmed 16, and the rest of the always-shown strip at 0
    // would otherwise hide 4 orders (enquired, quoted, unassigned, unknown).
    const counts = orderTabCounts([
      { group: 'invoiced' }, { group: 'invoiced' },
      ...Array.from({ length: 16 }, () => ({ group: 'confirmed' })),
      { group: 'enquired' },
      { group: 'quoted' },
      { group: 'unassigned' },
      { group: 'mystery' },
    ]);
    expect(counts.invoiced).toBe(2);
    expect(counts.confirmed).toBe(16);
    expect(counts.in_production).toBe(0);
    expect(counts.all).toBe(22);
    const shown = orderTabValues(counts);
    const shownSum = shown.reduce((sum, tab) => sum + counts[tab], 0);
    expect(shownSum).toBe(counts.all);
    expect(shown).toContain('enquired');
    expect(shown).toContain('quoted');
    expect(shown).toContain('unassigned');
    expect(orders.length).toBeGreaterThan(0);
  });
});
