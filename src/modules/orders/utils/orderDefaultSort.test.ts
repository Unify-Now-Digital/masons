import { describe, it, expect } from 'vitest';
import { sortOrdersByMode, sortOrdersByStoneThenAge, supplierEtaSortActive } from './orderDefaultSort';

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

describe('sortOrdersByMode eta', () => {
  it('puts confirmed dates first, then estimates, then orders with no supplier', () => {
    const rows = [
      { id: 'none', supplier: { kind: 'none', deliveryDate: null, deliveryEstimate: null } },
      { id: 'late', supplier: { kind: 'linked', deliveryDate: '2026-12-01', deliveryEstimate: null } },
      { id: 'batch', supplier: { kind: 'linked', deliveryDate: null, deliveryEstimate: 'MPL242 - In Transit', batchCodes: ['MPL242'] } },
      { id: 'early', supplier: { kind: 'linked', deliveryDate: '2026-11-02', deliveryEstimate: null } },
    ];
    expect(sortOrdersByMode(rows, 'eta').map((row) => row.id)).toEqual(['early', 'late', 'batch', 'none']);
  });
});

describe('supplierEtaSortActive', () => {
  it('flattens groups for the toolbar ETA sort and the Supplier column', () => {
    expect(supplierEtaSortActive('eta', null)).toBe(true);
    expect(supplierEtaSortActive('priority', 'supplier')).toBe(true);
    expect(supplierEtaSortActive('priority', 'customer')).toBe(false);
    expect(supplierEtaSortActive('priority', null)).toBe(false);
  });
});
