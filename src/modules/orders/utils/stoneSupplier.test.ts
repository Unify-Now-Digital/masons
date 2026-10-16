import { describe, expect, it } from 'vitest';
import type { SupplierRollup } from '../../../../supabase/functions/_shared/supplierStatus';
import { bulkStoneLabel, stoneSupplierState, supplierMatchFields } from './stoneSupplier';

const NOW = new Date('2026-10-15T12:00:00Z');

function board(partial: Partial<SupplierRollup> & Pick<SupplierRollup, 'kind'>): SupplierRollup {
  return {
    status: null,
    statusLabel: 'Waiting',
    tone: 'waiting',
    otherParts: 0,
    deliveryDate: null,
    deliveryEstimate: null,
    stale: false,
    syncedAt: null,
    jobCodes: [],
    batchCodes: [],
    containerCodes: [],
    parts: [],
    suggestions: [],
    ...partial,
  };
}

describe('stoneSupplierState', () => {
  it('covers every stone · supplier row', () => {
    expect(stoneSupplierState({ stoneStatus: 'NA', depositDate: '2026-09-01' }, null, NOW)).toEqual({
      tone: 'over', label: 'Order now', detail: '44d',
    });
    expect(stoneSupplierState({ stoneStatus: 'NA', depositDate: '2026-10-10' }, null, NOW)).toEqual({
      tone: 'needs', label: 'Order', detail: '5d',
    });
    expect(stoneSupplierState(
      { stoneStatus: 'NA', depositDate: '2026-09-01' },
      board({
        kind: 'suggested',
        tone: 'possible',
        statusLabel: 'Possible match · confirm?',
        batchCodes: ['MPL245'],
        suggestions: [{ linkId: 'link-1', confidence: 'medium', rule: 'surname', jobCode: null, reference: 'LAWRENCE' }],
      }),
      NOW,
    )).toEqual({ tone: 'match', label: 'Match?', detail: 'MPL245' });
    expect(stoneSupplierState(
      { stoneStatus: 'Ordered', stoneOrderedAt: '2026-10-02' },
      board({ kind: 'none', statusLabel: 'Not on supplier board' }),
      NOW,
    )).toEqual({ tone: 'over', label: 'Not at supplier', detail: 'ord 2 Oct' });
    expect(stoneSupplierState(
      { stoneStatus: 'Ordered' },
      board({ kind: 'linked', status: 'production', statusLabel: 'In production', tone: 'production', batchCodes: ['MPL240'] }),
      NOW,
    )).toEqual({ tone: 'wait', label: 'In production', detail: 'MPL240' });
    expect(stoneSupplierState(
      { stoneStatus: 'Ordered' },
      board({ kind: 'linked', status: 'transit', statusLabel: 'In transit', tone: 'transit', deliveryDate: '2026-11-06' }),
      NOW,
    )).toEqual({ tone: 'wait', label: 'In transit', detail: 'due 6 Nov' });
    expect(stoneSupplierState(
      { stoneStatus: 'Ordered' },
      board({ kind: 'linked', status: 'arrived', statusLabel: 'Arrived', tone: 'arrived', deliveryDate: '2026-11-15' }),
      NOW,
    )).toEqual({ tone: 'done', label: 'Arrived', detail: '15 Nov' });
    expect(stoneSupplierState(
      { stoneStatus: 'Ordered' },
      board({ kind: 'linked', status: null, batchCodes: ['MPL240'] }),
      NOW,
    )).toEqual({ tone: 'done', label: 'Ordered', detail: 'MPL240' });
  });

  it('does not warn before the board has loaded, and keeps a confirmed board ahead of not ordered', () => {
    expect(stoneSupplierState({ stoneStatus: 'Ordered' }, null, NOW).label).toBe('Ordered');
    expect(stoneSupplierState(
      { stoneStatus: 'NA', depositDate: '2026-09-01' },
      board({ kind: 'linked', status: 'production', statusLabel: 'In production', tone: 'production', batchCodes: ['MPL240'] }),
      NOW,
    ).label).toBe('In production');
    expect(stoneSupplierState({ stoneStatus: 'In Stock' }, board({ kind: 'none' }), NOW).label).toBe('In stock');
  });
});

describe('bulkStoneLabel', () => {
  it('omits a zero part and stays empty when both are zero', () => {
    expect(bulkStoneLabel(0, 0)).toBeNull();
    expect(bulkStoneLabel(1, 0)).toBe('Order 1 stone');
    expect(bulkStoneLabel(2, 0)).toBe('Order 2 stones');
    expect(bulkStoneLabel(0, 1)).toBe('1 to confirm');
    expect(bulkStoneLabel(0, 3)).toBe('3 to confirm');
    expect(bulkStoneLabel(1, 1)).toBe('Order 1 stone · 1 to confirm');
    expect(bulkStoneLabel(4, 2)).toBe('Order 4 stones · 2 to confirm');
  });
});

describe('supplierMatchFields', () => {
  it('hides matches when the supplier line differs from ours', () => {
    const fields = supplierMatchFields(
      {
        deceasedName: 'Eve Mason',
        customer: 'Ada Mason',
        dimensions: '30 × 20 × 3in',
        material: 'Granite',
        stoneStatus: 'NA',
      },
      board({
        kind: 'suggested',
        status: 'production',
        statusLabel: 'In production',
        tone: 'possible',
        parts: [{ description: 'Kerbs', jobCode: null, statusLabel: 'In production', tone: 'production', drives: true }],
        suggestions: [{ linkId: 'link-1', confidence: 'low', rule: 'number', jobCode: null, reference: 'OTHER FAMILY' }],
      }),
    );
    expect(fields.every((field) => field.matches === false)).toBe(true);
    expect(fields.map((field) => field.label)).toEqual(['Their name', 'Size', 'Material', 'Parts', 'Status']);
  });

  it('marks a field when the supplier line equals ours', () => {
    const fields = supplierMatchFields(
      {
        deceasedName: 'David Parson',
        dimensions: '36 × 24 × 3in',
        material: 'Blue pearl',
        stoneStatus: 'NA',
      },
      board({
        kind: 'suggested',
        status: 'production',
        statusLabel: 'In production',
        tone: 'possible',
        parts: [{
          description: 'Blue pearl 36 × 24 × 3in',
          jobCode: null,
          statusLabel: 'In production',
          tone: 'production',
          drives: true,
        }],
        suggestions: [{ linkId: 'link-1', confidence: 'medium', rule: 'surname', jobCode: null, reference: '267 PARSON SM' }],
      }),
    );
    expect(fields.find((field) => field.label === 'Their name')?.matches).toBe(true);
    expect(fields.find((field) => field.label === 'Size')?.matches).toBe(true);
    expect(fields.find((field) => field.label === 'Material')?.matches).toBe(true);
    expect(fields.find((field) => field.label === 'Status')?.matches).toBe(false);
  });
});
