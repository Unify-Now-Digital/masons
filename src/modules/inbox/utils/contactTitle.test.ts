import { describe, expect, it } from 'vitest';
import { contactNamesByPhone, formatPhoneDisplay, resolveContactTitle } from './contactTitle';

describe('inbox contact titles', () => {
  it('formats a raw UK mobile', () => {
    expect(formatPhoneDisplay('+447700900123')).toBe('+44 7700 900123');
    expect(formatPhoneDisplay('07700900123')).toBe('+44 7700 900123');
    expect(formatPhoneDisplay('447903145910')).toBe('+44 7903 145910');
    expect(formatPhoneDisplay('448000282321')).toBe('+44 8000 282321');
    expect(formatPhoneDisplay('07956013764')).toBe('+44 7956 013764');
    expect(formatPhoneDisplay('+447853687766')).toBe('+44 7853 687766');
  });

  it('leaves names and message text alone', () => {
    expect(formatPhoneDisplay('Ada Lovelace')).toBe('Ada Lovelace');
    expect(formatPhoneDisplay('Please call 07956013764')).toBe('Please call 07956013764');
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
    expect(resolveContactTitle('+447700900000', directory)).toBe('+44 7700 900000');
    expect(resolveContactTitle('447903145910', directory)).toBe('+44 7903 145910');
    expect(resolveContactTitle('ada@example.com', directory)).toBe('ada@example.com');
  });

  it('labels a punctuation surname as missing', () => {
    const directory = contactNamesByPhone(
      [{ first_name: 'Dean', last_name: '.', phone: '07700900111' }],
      [{ person_name: 'Dean .', customer_phone: '07700900222' }],
    );
    expect(resolveContactTitle('07700900111', directory)).toBe('Dean (no surname)');
    expect(resolveContactTitle('07700900222', directory)).toBe('Dean (no surname)');
    expect(resolveContactTitle('07700900111', directory)).not.toBe('Dean .');
  });

  it('formats a phone stored as the contact name', () => {
    const directory = contactNamesByPhone(
      [{ first_name: '07956013764', phone: '07956013764' }],
      [{ person_name: '+447853687766', customer_phone: '+447853687766' }],
    );
    expect(resolveContactTitle('07956013764', directory)).toBe('+44 7956 013764');
    expect(resolveContactTitle('+447853687766', directory)).toBe('+44 7853 687766');
    expect(resolveContactTitle('+447853687766', new Map())).toBe('+44 7853 687766');
  });
});
