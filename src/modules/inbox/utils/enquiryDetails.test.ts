import { describe, expect, it } from 'vitest';
import { parseQuoteEnquiry } from './enquiryDetails';

const base = {
  name: 'Test Headstone',
  type: 'Lawn Headstones',
  colour: 'Test Grey',
  size: 'Standard (100 x 60cm)',
  font: 'script',
  letterColour: 'gold',
  infillType: 'chippings',
  infillColour: 'white',
  inscription: 'Line one\nLine two',
  image: 'https://example.test/storage/v1/object/public/product-images/a.png',
};

describe('parseQuoteEnquiry', () => {
  it('returns null without a product name (legacy rows)', () => {
    expect(parseQuoteEnquiry({ id: 'e1', details: { product_slug: 'x', budget: '1000' } })).toBeNull();
    expect(parseQuoteEnquiry({ id: 'e1', details: { ...base, name: '  ' } })).toBeNull();
    expect(parseQuoteEnquiry({ id: 'e1', details: null })).toBeNull();
  });

  it('reads price as string or number; total = price + permit_fee, line items never added', () => {
    const lines = [{ name: 'Extra Lettering', price: 50 }];
    const fromString = parseQuoteEnquiry({ id: 'e1', details: { ...base, price: '1250', permit_fee: 150, addonLineItems: lines } });
    expect(fromString).toMatchObject({ price: 1250, permitFee: 150, guideTotal: 1400 });
    const fromNumber = parseQuoteEnquiry({ id: 'e1', details: { ...base, price: 1250, permit_fee: 0 } });
    expect(fromNumber).toMatchObject({ price: 1250, permitFee: 0, guideTotal: 1250 });
  });

  it('has no total without a numeric price', () => {
    expect(parseQuoteEnquiry({ id: 'e1', details: { ...base, permit_fee: 150 } })?.guideTotal).toBeNull();
  });

  it('labels font and capitalises lettering', () => {
    expect(parseQuoteEnquiry({ id: 'e1', details: base })).toMatchObject({ font: 'Script', lettering: 'Gold' });
    expect(parseQuoteEnquiry({ id: 'e1', details: { ...base, font: 'traditional' } })?.font).toBe('Traditional');
  });

  it('shows infill only when a Kerb Infill line item exists, and keeps that line out of addons', () => {
    expect(parseQuoteEnquiry({ id: 'e1', details: base })?.infill).toBeNull();
    const withLine = parseQuoteEnquiry({
      id: 'e1',
      details: { ...base, addonLineItems: [{ name: 'Kerb Infill — Chippings (White)', price: 250 }] },
    });
    expect(withLine?.infill).toBe('Chippings · White');
    expect(withLine?.addons).toEqual([]);
  });

  it('falls back to legacy addons strings when there are no line items', () => {
    expect(parseQuoteEnquiry({ id: 'e1', details: { ...base, addons: ['Vase', ''] } })?.addons).toEqual(['Vase']);
    expect(parseQuoteEnquiry({ id: 'e1', details: base })?.addons).toEqual([]);
  });

  it('keeps https images only', () => {
    expect(parseQuoteEnquiry({ id: 'e1', details: base })?.imageUrl).toBe(base.image);
    expect(parseQuoteEnquiry({ id: 'e1', details: { ...base, image: '/images/a.png' } })?.imageUrl).toBeNull();
  });

  it('omits blank optional values', () => {
    expect(parseQuoteEnquiry({ id: 'e1', details: { name: 'Test Headstone', size: '' } })).toMatchObject({
      type: null, size: null, font: null, lettering: null, inscription: null, imageUrl: null,
    });
  });
});
