import { describe, expect, it } from 'vitest';
import { orderMatchesQuery, orderRefLabel, personMatchesQuery, personResultName, ukPhoneKey } from './paletteSearch';

const ada = { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', phone: '+447700900123' };

describe('Cmd-K people search', () => {
  it('finds a person by First Last, by email and by phone in either 07 or +44 form', () => {
    expect(personMatchesQuery(ada, 'Ada Lovelace')).toBe(true);
    expect(personMatchesQuery(ada, 'ada lovelace')).toBe(true);
    expect(personMatchesQuery(ada, 'ada@example.com')).toBe(true);
    expect(personMatchesQuery(ada, '07700900123')).toBe(true);
    expect(personMatchesQuery(ada, '+44 7700 900123')).toBe(true);
    expect(personMatchesQuery({ ...ada, phone: '07700900123' }, '+447700900123')).toBe(true);
    expect(ukPhoneKey('07700900123')).toBe(ukPhoneKey('+447700900123'));
  });

  it('does not match a different person or a short digit fragment', () => {
    expect(personMatchesQuery(ada, 'Grace Hopper')).toBe(false);
    expect(personMatchesQuery(ada, '07')).toBe(false);
    expect(personMatchesQuery({ first_name: 'Dean', last_name: '.' }, 'Dean')).toBe(true);
  });

  it('labels a missing surname and an order ref as ORD-000123', () => {
    expect(personResultName({ first_name: 'Dean', last_name: '.' })).toBe('Dean (no surname)');
    expect(personResultName({ first_name: 'Dean', last_name: '.' })).not.toBe('Dean .');
    expect(orderRefLabel(123)).toBe('ORD-000123');
    expect(orderMatchesQuery({ order_number: 123, customer_name: 'Sam' }, 'ORD-000123')).toBe(true);
    expect(orderMatchesQuery({ order_number: 123, customer_name: 'Sam' }, 'OR-123')).toBe(false);
  });
});
