import { describe, expect, it } from 'vitest';
import { contactNamesByPhone, formatPhoneDisplay, resolveContactTitle } from './contactTitle';

describe('inbox contact titles', () => {
  it('formats a raw UK mobile', () => {
    expect(formatPhoneDisplay('+447700900123')).toBe('07700 900123');
    expect(formatPhoneDisplay('07700900123')).toBe('07700 900123');
  });

  it('keeps an email address as typed', () => {
    expect(formatPhoneDisplay('Ada@Example.com')).toBe('Ada@Example.com');
  });

  it('resolves a phone to the customer, then the order contact', () => {
    const directory = contactNamesByPhone(
      [{ first_name: 'Ada', last_name: 'Lovelace', phone: '07700 900123' }],
      [{ person_name: 'From order', customer_phone: '+447700900999' }],
    );
    expect(resolveContactTitle('+447700900123', directory)).toBe('Ada Lovelace');
    expect(resolveContactTitle('07700900999', directory)).toBe('From order');
    expect(resolveContactTitle('+447700900000', directory)).toBe('07700 900000');
    expect(resolveContactTitle('ada@example.com', directory)).toBe('ada@example.com');
  });
});
