import { describe, expect, it } from 'vitest';
import {
  balanceInvoiceAmount,
  extendedMoney,
  formOrderGross,
  personSelectOptions,
} from './invoiceBuilder';

describe('balanceInvoiceAmount', () => {
  it('prefills the outstanding balance, not the full order total', () => {
    expect(balanceInvoiceAmount(4602.2, 2489.1)).toBe(2113.1);
  });

  it('does not go below zero when payments cover the order', () => {
    expect(balanceInvoiceAmount(100, 150)).toBe(0);
    expect(balanceInvoiceAmount(Number.NaN, 10)).toBe(0);
  });
});

describe('formOrderGross', () => {
  it('recalculates when the product price, quantity or an add-on changes', () => {
    expect(formOrderGross({
      order_type: 'New Memorial',
      value: 1000,
      product_quantity: 2,
      permit_cost: 50,
      additional_options: [{ name: 'Photo', cost: 40, quantity: 3 }],
    })).toBe(1000 * 2 + 50 + 40 * 3);
    expect(extendedMoney(12.5, 4)).toBe(50);
  });
});

describe('personSelectOptions', () => {
  it('labels real people, formats bare numbers, and hides nameless rows', () => {
    const options = personSelectOptions([
      { id: '1', first_name: 'Anne', last_name: 'Marshall', phone: '07700900111', email: 'anne@example.com' },
      { id: '2', first_name: '07700900111', last_name: '', phone: '+447700900111' },
      { id: '3', first_name: 'wa_user_88', last_name: '', phone: '07700900222' },
      { id: '4', first_name: '', last_name: '', phone: null, email: null },
      { id: '5', first_name: 'David', last_name: 'Amponsah', phone: '07700900333' },
    ]);
    expect(options.map((o) => o.label)).toEqual([
      'Anne Marshall',
      'David Amponsah',
      '+44 7700 900222',
    ]);
    expect(options.find((o) => o.label === 'Anne Marshall')?.id).toBe('1');
    expect(options.find((o) => o.id === '4')).toBeUndefined();
    expect(options.find((o) => o.label === '+44 7700 900222')?.search).toContain('07700900222');
  });
});
