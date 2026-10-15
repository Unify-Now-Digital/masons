import { describe, expect, it } from 'vitest';
import { columnXs, estimateLabelWidth, LABEL_PX, sankeyHeight } from './sankeyLayout';

describe('sankey layout', () => {
  it('keeps desktop height in the 300–340 band and grows with the node count', () => {
    expect(sankeyHeight(1)).toBe(300);
    expect(sankeyHeight(3)).toBe(304);
    expect(sankeyHeight(4)).toBe(332);
    expect(sankeyHeight(4)).toBeGreaterThan(sankeyHeight(3));
    expect(sankeyHeight(8)).toBe(340);
    expect(LABEL_PX).toBeGreaterThanOrEqual(12);
  });

  it('places the right column from the measured label, across the full card', () => {
    const labels: [number, number, number] = [
      estimateLabelWidth('Not recorded', '9 · 8% · £38,107'),
      estimateLabelWidth('Enquiry', '69 · 65% · £168,643'),
      estimateLabelWidth('Deposit paid', '16 · 15% · £62,101'),
    ];
    const card = 1200;
    const laid = columnXs(card, labels);
    expect(laid.width).toBe(card);
    expect(laid.x[2] + laid.rightMargin).toBe(card);
    expect(laid.rightMargin).toBeLessThan(Math.round(card * 0.28));
    expect(laid.x[0]).toBeLessThan(20);
    expect(laid.x[1]).toBeGreaterThan(laid.x[0]);
    expect(laid.x[2]).toBeGreaterThan(laid.x[1]);
    expect(Math.abs(laid.x[1] - (laid.x[0] + laid.x[2]) / 2)).toBeLessThan(1);
    expect(laid.x[2]).toBeGreaterThan(card - Math.round(card * 0.28));
  });

  it('widens the view instead of overlapping when labels do not fit', () => {
    const laid = columnXs(320, [200, 200, 200]);
    expect(laid.width).toBeGreaterThan(320);
    expect(laid.x[0]).toBeLessThan(laid.x[1]);
    expect(laid.x[1]).toBeLessThan(laid.x[2]);
    expect(laid.x[2] + laid.rightMargin).toBeCloseTo(laid.width, 0);
  });
});
