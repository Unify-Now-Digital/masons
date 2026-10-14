import { describe, it, expect } from 'vitest';
import { sortOrdersByStoneThenAge } from './orderDefaultSort';

describe('sortOrdersByStoneThenAge', () => {
  it('puts stone-not-ordered first, each block oldest first', () => {
    const rows = [
      { id: 'a', stoneStatus: 'Ordered', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'b', stoneStatus: 'NA', createdAt: '2026-05-01T00:00:00Z' },
      { id: 'c', stoneStatus: 'In Stock', createdAt: '2025-12-01T00:00:00Z' },
      { id: 'd', stoneStatus: 'NA', createdAt: '2026-02-01T00:00:00Z' },
      { id: 'e', stoneStatus: null, createdAt: null },
    ];
    expect(sortOrdersByStoneThenAge(rows).map((r) => r.id)).toEqual(['d', 'b', 'e', 'c', 'a']);
  });
});
