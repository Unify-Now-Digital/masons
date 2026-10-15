import { describe, expect, it, beforeEach } from 'vitest';
import { panelMoney, readSectionState, writeSectionState, CONTEXT_PANEL_SECTIONS } from './contextPanel';

describe('panelMoney', () => {
  it('balance = total (value + permit) − matched payments', () => {
    const m = panelMoney(2485, 185, [{ amount: 1000, status: 'matched' }, { amount: '200.50', status: 'matched' }]);
    expect(m.paid).toBe(1200.5);
    expect(m.balanceDue).toBe(1284.5);
  });
  it('ignores unmatched / dismissed payments', () => {
    const m = panelMoney(1000, 0, [{ amount: 500, status: 'unmatched' }, { amount: 100, status: 'dismissed' }]);
    expect(m.paid).toBe(0);
    expect(m.balanceDue).toBe(1000);
  });
  it('deposit = 50% memorial + 100% permit; paid once covered', () => {
    const m = panelMoney(1120, 120, []);
    expect(m.depositTarget).toBe(620);
    expect(m.depositPaid).toBe(false);
    expect(m.depositOutstanding).toBe(620);
    expect(panelMoney(1120, 120, [{ amount: 620, status: 'matched' }]).depositPaid).toBe(true);
  });
  it('never negative', () => {
    expect(panelMoney(100, 0, [{ amount: 150, status: 'matched' }]).balanceDue).toBe(0);
  });
});

describe('section state', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      clear: () => m.clear(),
    };
  });
  it('fixed order', () => {
    expect(CONTEXT_PANEL_SECTIONS).toEqual(['next', 'money', 'progress', 'details', 'contact', 'orders']);
  });
  it('remembers collapsed sections', () => {
    expect(readSectionState().money).toBeUndefined();
    writeSectionState({ money: false });
    expect(readSectionState().money).toBe(false);
  });
});
