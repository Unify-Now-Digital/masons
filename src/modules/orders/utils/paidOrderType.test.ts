import { describe, expect, it } from 'vitest';
import { resolvePaidCustomerOrderType } from './paidOrderType';

describe('resolvePaidCustomerOrderType', () => {
  it('defaults to New Memorial with empty evidence', () => {
    expect(resolvePaidCustomerOrderType()).toBe('New Memorial');
    expect(resolvePaidCustomerOrderType({})).toBe('New Memorial');
  });

  it('never returns quote even when current type is quote', () => {
    expect(resolvePaidCustomerOrderType({ order_type: 'quote' })).toBe('New Memorial');
    expect(resolvePaidCustomerOrderType({ order_type: 'Quote' })).toBe('New Memorial');
    expect(resolvePaidCustomerOrderType({ order_type: 'QUOTE' })).toBe('New Memorial');
  });

  it('keeps New Memorial when already set', () => {
    expect(resolvePaidCustomerOrderType({ order_type: 'New Memorial' })).toBe('New Memorial');
    expect(resolvePaidCustomerOrderType({ order_type: 'new-memorial' })).toBe('New Memorial');
  });

  it('returns Renovation when order_type is Renovation', () => {
    expect(resolvePaidCustomerOrderType({ order_type: 'Renovation' })).toBe('Renovation');
    expect(resolvePaidCustomerOrderType({ order_type: 'renovation' })).toBe('Renovation');
  });

  it('returns Renovation when renovation service description is set', () => {
    expect(
      resolvePaidCustomerOrderType({
        order_type: 'quote',
        renovation_service_description: 'Clean and re-letter',
      })
    ).toBe('Renovation');
  });

  it('returns Renovation when renovation_service_cost > 0', () => {
    expect(
      resolvePaidCustomerOrderType({ order_type: 'quote', renovation_service_cost: 450 })
    ).toBe('Renovation');
    expect(
      resolvePaidCustomerOrderType({ order_type: null, renovation_service_cost: '120.50' })
    ).toBe('Renovation');
  });

  it('ignores zero/empty renovation cost without description', () => {
    expect(resolvePaidCustomerOrderType({ renovation_service_cost: 0 })).toBe('New Memorial');
    expect(resolvePaidCustomerOrderType({ renovation_service_cost: '' })).toBe('New Memorial');
    expect(resolvePaidCustomerOrderType({ renovation_service_description: '  ' })).toBe(
      'New Memorial'
    );
  });
});
