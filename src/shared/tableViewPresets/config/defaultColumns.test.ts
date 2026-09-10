import { describe, expect, it } from 'vitest';
import { getDefaultColumnOrder, ordersColumns } from './defaultColumns';

/** Live Order table column IDs (SortableOrdersTable / orderColumnDefinitions). */
const LIVE_ORDER_COLUMN_IDS = [
  'id',
  'customer',
  'customerType',
  'deceasedName',
  'type',
  'photo',
  'stoneStatus',
  'material',
  'color',
  'permitStatus',
  'proofStatus',
  'value',
  'dueDate',
  'timeline',
  'messages',
] as const;

describe('ordersColumns presets', () => {
  it('includes every live Orders column so drag order/widths can persist', () => {
    const ids = ordersColumns.map((c) => c.id);
    for (const id of LIVE_ORDER_COLUMN_IDS) {
      expect(ids).toContain(id);
    }
    expect(ids).toEqual([...LIVE_ORDER_COLUMN_IDS]);
  });

  it('default order matches the live column list', () => {
    expect(getDefaultColumnOrder('orders')).toEqual([...LIVE_ORDER_COLUMN_IDS]);
  });
});
