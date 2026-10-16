import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: () => ({}) } }));
import type { UIOrder } from './orderTransform';
import type { SupplierRollup } from '../../../../supabase/functions/_shared/supplierStatus';
import { buildFilterOptions, supplierFilterValue } from './orderColumnFilters';

function order(partial: Partial<UIOrder> & Pick<UIOrder, 'id'>): UIOrder {
  return {
    order_number: 1,
    customer: 'Ada',
    deceasedName: 'Eve',
    type: 'New Memorial',
    stoneStatus: 'NA',
    createdAt: '2026-01-01',
    permitStatus: 'NA',
    proofStatus: 'NA',
    dueDate: '',
    depositDate: '',
    secondPaymentDate: null,
    installationDate: null,
    value: '',
    total: 0,
    location: '',
    progress: 0,
    assignedTo: '',
    priority: 'normal',
    sku: '',
    material: '',
    color: '',
    timelineWeeks: 12,
    quoteId: null,
    isTest: false,
    group: 'confirmed',
    jobStage: 'confirmed',
    leadSource: null,
    leadChannel: null,
    jobPaidAt: null,
    jobExitReason: null,
    invoiceLocked: false,
    supplierLoaded: true,
    ...partial,
  };
}

const none: SupplierRollup = {
  kind: 'none', status: null, statusLabel: 'Not on supplier board', tone: 'waiting', otherParts: 0,
  deliveryDate: null, deliveryEstimate: null, stale: false, syncedAt: null, jobCodes: [], batchCodes: [],
  containerCodes: [], parts: [], suggestions: [],
};

describe('supplier filters', () => {
  it('splits stones never ordered from stones ordered and missing on the board', () => {
    const fresh = order({ id: 'fresh', stoneStatus: 'NA', supplier: none });
    const ordered = order({ id: 'ordered', stoneStatus: 'Ordered', supplier: none });
    const stock = order({ id: 'stock', stoneStatus: 'In Stock', supplier: none });
    expect(supplierFilterValue(fresh)).toBe('Not ordered yet');
    expect(supplierFilterValue(ordered)).toBe('Ordered, not on supplier board');
    expect(supplierFilterValue(stock)).toBe('');
    const options = buildFilterOptions([fresh, fresh, ordered]);
    expect(options.supplier.find((option) => option.value === 'Not ordered yet')?.count).toBe(2);
    expect(options.supplier.find((option) => option.value === 'Ordered, not on supplier board')?.count).toBe(1);
  });

  it('counts unordered stones before the supplier board has loaded', () => {
    const waiting = order({ id: 'waiting', stoneStatus: 'NA', supplierLoaded: false, supplier: undefined });
    const ordered = order({ id: 'ordered', stoneStatus: 'Ordered', supplierLoaded: false, supplier: undefined });
    expect(supplierFilterValue(waiting)).toBe('Not ordered yet');
    expect(supplierFilterValue(ordered)).toBe('');
    const options = buildFilterOptions([waiting, ordered]);
    expect(options.supplier.find((option) => option.value === 'Not ordered yet')?.count).toBe(1);
    expect(options.supplier.find((option) => option.value === 'Ordered, not on supplier board')?.count).toBe(0);
  });
});
