import { describe, expect, it } from 'vitest';
import { orderTabCounts, orderTabValues, splitOrderTabs } from './orderGrouping';

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

  it('puts stages that are off the strip into More, and those counts still add up to All', () => {
    const counts = orderTabCounts([
      ...Array.from({ length: 16 }, () => ({ group: 'confirmed' })),
      { group: 'invoiced' },
      { group: 'invoiced' },
      { group: 'enquired' },
      { group: 'quoted' },
      { group: 'fixed' },
      { group: 'mystery' },
    ]);
    expect(counts.all).toBe(22);
    const { visible, more } = splitOrderTabs('confirmed');
    expect(visible).toEqual(['confirmed', 'invoiced', 'all']);
    expect(more).toEqual(['enquired', 'quoted', 'in_production', 'fixed', 'complete', 'unassigned']);
    const stages = [...visible, ...more].filter((tab) => tab !== 'all');
    const sum = stages.reduce((total, tab) => total + counts[tab], 0);
    expect(sum).toBe(counts.all);
    expect(counts.enquired + counts.quoted + counts.fixed + counts.unassigned).toBe(4);
  });
});
