import { describe, expect, it } from 'vitest';
import type { Order } from '../types/orders.types';
import { transformOrderForUI } from './orderTransform';

describe('order display name', () => {
  it('shows a surname with no letters or digits as missing', () => {
    const stored = transformOrderForUI({ person_name: 'Dean .', customer_name: 'Eve Mason' } as Order);
    expect(stored.customer).toBe('Dean (no surname)');
    expect(stored.customer).not.toBe('Dean .');

    const joined = transformOrderForUI({
      person_name: null,
      customer_name: 'Eve .',
      customers: { first_name: 'Dean', last_name: '•' },
    } as Order);
    expect(joined.customer).toBe('Dean (no surname)');
    expect(joined.deceasedName).toBe('Eve (no surname)');
  });
});
