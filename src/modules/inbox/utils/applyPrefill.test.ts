import { describe, expect, it } from 'vitest';
import { applyPrefill, type PrefillEntry } from './applyPrefill';

// Fixtures use invented values only.

const f = (value: string, evidence = `quote: ${value}`) => ({ value, evidence });
const names = (out: PrefillEntry[]) => out.map((e) => e.name);
const clean = () => false;

/** CreateOrderDrawer's defaults for the seven fields. */
const EMPTY = {
  customer_name: '',
  location: '',
  sku: '',
  order_type: undefined,
  material: '',
  color: '',
  inscription_text: null,
};

describe('applyPrefill', () => {
  it('applies to empty, clean fields, trimming the value and keeping the evidence', () => {
    const out = applyPrefill({ customer_name: f(' Arthur Example '), sku: f('B/12') }, EMPTY, clean);
    expect(out).toEqual([
      { name: 'customer_name', value: 'Arthur Example', evidence: 'quote:  Arthur Example ' },
      { name: 'sku', value: 'B/12', evidence: 'quote: B/12' },
    ]);
  });

  it('treats undefined, null and blank current values as empty', () => {
    const out = applyPrefill(
      { order_type: f('New Memorial'), inscription_text: f('In loving memory'), location: f('St Example churchyard') },
      { ...EMPTY, location: '   ' },
      clean,
    );
    expect(names(out)).toEqual(['order_type', 'location', 'inscription_text']);
  });

  it('skips a field the user typed into before extraction returned', () => {
    const out = applyPrefill({ location: f('St Example churchyard'), sku: f('B/12') }, { ...EMPTY, location: 'Typed' }, clean);
    expect(names(out)).toEqual(['sku']);
  });

  it('skips a dirty field even when it is empty', () => {
    const out = applyPrefill({ location: f('St Example churchyard'), sku: f('B/12') }, EMPTY, (n) => n === 'location');
    expect(names(out)).toEqual(['sku']);
  });

  it('ignores keys outside the seven R-005 names', () => {
    const out = applyPrefill({ notes: f('call back'), value: f('1200'), product_id: f('p1'), sku: f('B/12') }, EMPTY, clean);
    expect(names(out)).toEqual(['sku']);
  });

  it('ignores null fields and malformed entries', () => {
    const out = applyPrefill(
      {
        customer_name: null,
        location: { value: 'St Example churchyard' },
        sku: { value: 12, evidence: 'grave 12' },
        material: f('   '),
        color: f('Grey', '  '),
        inscription_text: f('In loving memory'),
      },
      EMPTY,
      clean,
    );
    expect(names(out)).toEqual(['inscription_text']);
  });

  it('rejects an order_type that is not one of the form values', () => {
    expect(applyPrefill({ order_type: f('Headstone') }, EMPTY, clean)).toEqual([]);
  });

  it('returns nothing when there are no fields', () => {
    expect(applyPrefill(null, EMPTY, clean)).toEqual([]);
    expect(applyPrefill(undefined, EMPTY, clean)).toEqual([]);
  });

  it('puts order_type first', () => {
    const out = applyPrefill(
      { inscription_text: f('In loving memory'), sku: f('B/12'), order_type: f('New Memorial'), customer_name: f('Arthur Example') },
      EMPTY,
      clean,
    );
    expect(names(out)).toEqual(['order_type', 'customer_name', 'sku', 'inscription_text']);
  });

  it('keeps material and colour for New Memorial', () => {
    const out = applyPrefill({ order_type: f('New Memorial'), material: f('Granite'), color: f('Black') }, EMPTY, clean);
    expect(names(out)).toEqual(['order_type', 'material', 'color']);
  });

  it('omits material and colour when the extracted order_type is Renovation', () => {
    const out = applyPrefill(
      { order_type: f('Renovation'), material: f('Granite'), color: f('Black'), sku: f('B/12') },
      EMPTY,
      clean,
    );
    expect(names(out)).toEqual(['order_type', 'sku']);
  });

  it('omits material and colour when the user already chose Renovation', () => {
    const out = applyPrefill(
      { order_type: f('New Memorial'), material: f('Granite'), color: f('Black'), sku: f('B/12') },
      { ...EMPTY, order_type: 'Renovation' },
      clean,
    );
    expect(names(out)).toEqual(['sku']);
  });
});
