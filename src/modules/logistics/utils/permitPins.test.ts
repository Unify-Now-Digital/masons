import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PERMIT_PIN_STYLES, cleanLocation, hiddenOrderIds, isConfirmedOrder, normalisePermitStatus, permitPinInnerSvg, permitPinStyle, placePin, toOrderPin, type PinOrderRow } from './permitPins';

const base: PinOrderRow = {
  id: 'abcdef12-0000', order_number: 272, customer_name: 'Jane Doe', person_name: null, permit_status: 'form_sent',
  location: null, latitude: null, longitude: null, stage: 'deposit_paid', archived_at: null, is_test: false,
  job: { stage: 'confirmed', exit_reason: null }, cemetery: null,
};

describe('permitPins', () => {
  it('maps permit statuses to the status-palette colours', () => {
    expect(permitPinStyle('form_sent').colour).toBe('#5B6573');
    expect(permitPinStyle('customer_completed').colour).toBe('#A3361E');
    expect(permitPinStyle('pending').colour).toBe('#3F4752');
    expect(permitPinStyle('approved').colour).toBe('#1E7B47');
    expect(permitPinStyle('not_started').hollow).toBe(true);
    expect(normalisePermitStatus('Customer Completed')).toBe('customer_completed');
    expect(normalisePermitStatus('weird')).toBe('unknown');
  });

  it('confirmed = deposit paid onward, not installed/exited/test/archived', () => {
    expect(isConfirmedOrder(base)).toBe(true);
    expect(isConfirmedOrder({ ...base, job: { stage: 'quoted', exit_reason: null }, stage: 'quote_received' })).toBe(false);
    expect(isConfirmedOrder({ ...base, job: { stage: 'confirmed', exit_reason: 'lost' } })).toBe(false);
    expect(isConfirmedOrder({ ...base, job: { stage: 'fixed', exit_reason: null } })).toBe(false);
    expect(isConfirmedOrder({ ...base, archived_at: '2026-01-01' })).toBe(false);
    expect(isConfirmedOrder({ ...base, is_test: true })).toBe(false);
  });

  it('places pin: order coords, then cemetery coords, then geocode', () => {
    expect(placePin({ ...base, latitude: '51.4', longitude: '-0.1' })).toMatchObject({ source: 'order', lat: 51.4, lng: -0.1 });
    const cem = { name: 'Hoddesdon Cemetery', address: 'Ware Road', postcode: 'EN11', latitude: 51.76, longitude: -0.01 };
    expect(placePin({ ...base, cemetery: cem })).toMatchObject({ source: 'cemetery', lat: 51.76 });
    expect(placePin({ ...base, cemetery: { ...cem, latitude: null, longitude: null } })).toMatchObject({
      source: 'geocode', geocodeQuery: 'Hoddesdon Cemetery, Ware Road, EN11, UK',
    });
    expect(placePin({ ...base, location: 'Hillview Cemetery plot H328' })).toMatchObject({ source: 'geocode', geocodeQuery: 'Hillview Cemetery, UK' });
    expect(placePin(base).source).toBe('none');
  });

  it('cleans plot refs and builds ORD ref', () => {
    expect(cleanLocation('Manor Park E7 · plot SVSL2082')).toBe('Manor Park E7');
    expect(toOrderPin(base).ref).toBe('ORD-000272');
    expect(toOrderPin({ ...base, location: 'Lambeth Cemetery plot 94' }).cemeteryName).toBe('Lambeth Cemetery');
  });
});

describe('permit pin palette', () => {
  it('every pin colour is distinct from every other filled/hollow combination', () => {
    const keys = PERMIT_PIN_STYLES.map((p) => `${p.colour}|${p.hollow}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('no two statuses share a colour', () => {
    const c = PERMIT_PIN_STYLES.map((p) => p.colour.toUpperCase());
    expect(new Set(c).size).toBe(c.length);
  });
  it('gives each status its own shape and keeps the colour', () => {
    const shapes = PERMIT_PIN_STYLES.map((p) => p.shape);
    expect(new Set(shapes).size).toBe(shapes.length);
    expect(PERMIT_PIN_STYLES.find((p) => p.status === 'approved')?.colour).toBe('#1E7B47');
    expect(PERMIT_PIN_STYLES.find((p) => p.status === 'not_started')?.hollow).toBe(true);
    const glyphs = PERMIT_PIN_STYLES.map((p) => permitPinInnerSvg(p, p.colour));
    expect(new Set(glyphs).size).toBe(glyphs.length);
    for (const p of PERMIT_PIN_STYLES) {
      if (p.shape === 'dash') continue;
      expect(permitPinInnerSvg(p, p.colour)).not.toContain(p.colour);
    }
  });

  it('hidden statuses drop those orders from the map', () => {
    const formSent = toOrderPin(base);
    const approved = toOrderPin({ ...base, id: 'bbbbbbbb-1111', permit_status: 'approved' });
    const hidden = hiddenOrderIds([formSent, approved], new Set(['form_sent']));
    expect([...hidden]).toEqual([base.id]);
    expect([formSent, approved].filter((p) => !hidden.has(p.orderId)).map((p) => p.permitStatus)).toEqual(['approved']);
    expect(hiddenOrderIds([formSent], new Set()).size).toBe(0);
  });

  it('hex fallbacks match the tokens in tokens.css', () => {
    const css = readFileSync(resolve(__dirname, '../../../styles/tokens.css'), 'utf8');
    for (const p of PERMIT_PIN_STYLES) {
      const m = new RegExp(`${p.token}:\\s*(#[0-9A-Fa-f]{6})`).exec(css);
      expect(m?.[1]?.toUpperCase(), p.token).toBe(p.colour.toUpperCase());
    }
  });
});
