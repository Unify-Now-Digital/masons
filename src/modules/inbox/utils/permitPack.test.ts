import { describe, expect, it } from 'vitest';
import { permitPackItems } from '@/modules/inbox/utils/permitPack';
import type { Order } from '@/modules/orders/types/orders.types';

describe('permitPackItems', () => {
  it('shows placeholders for uncaptured fields', () => {
    const items = permitPackItems({ person_name: 'John Smith', location: 'Plot 12', permit_cost: 250, deposit_date: null, inscription_text: 'In loving memory' } as unknown as Order);
    expect(items).toHaveLength(5);
    expect(items[0].value).toContain('Not captured yet');
    expect(items[1].tone).toBe('amber');
    expect(items[3].value).toBe('Not captured yet');
    expect(items[4].tone).toBe('red');
  });
});
