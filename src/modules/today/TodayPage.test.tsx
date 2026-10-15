/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Tier, type Lane, type TodayInput, type TodayItem } from './todayModel';

const bag = vi.hoisted(() => ({
  NOW: Date.parse('2026-10-15T12:00:00Z'),
  sales: [] as TodayItem[],
  cs: [] as TodayItem[],
  proofs: [] as TodayInput[],
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }));
vi.mock('@/app/components/useCanSeeMoney', () => ({ useCanSeeMoney: () => true }));
vi.mock('@/shared/context/OrganizationContext', () => ({
  useOrganization: () => ({ organizationId: 'org-1', organizationName: 'Acme Masonry' }),
}));
vi.mock('@/shared/context/orderPanel', () => ({ useOpenOrder: () => () => {} }));
vi.mock('@/shared/context/personPanel', () => ({ useOpenPerson: () => () => {} }));
vi.mock('@/modules/sections/useSectionsData', () => ({ useNow: () => new Date(bag.NOW) }));
vi.mock('./useBrandData', () => ({
  useBrandData: () => ({ data: { data: {}, moneyError: null }, isError: false, isLoading: false, error: null }),
}));
vi.mock('@/shared/priority', () => ({
  SHARED_CAP: 15,
  useSharedPriority: () => ({ enquiries: [], customers: [], enquiriesLoading: false, customersLoading: false }),
  groupConsecutive: (rows: { why: string }[]) => rows.map((r) => ({ why: r.why, items: [r] })),
}));
vi.mock('./sharedLanes', () => ({
  SHARED_LANES: ['Sales', 'CS'] as Lane[],
  hubLaneItems: (_rows: unknown, lane: Lane) => (lane === 'Sales' ? bag.sales : bag.cs),
}));
vi.mock('./todayRules', () => ({ allTodayInputs: () => bag.proofs }));

import { TodayPage } from './TodayPage';

const ago = (ms: number) => new Date(bag.NOW - ms).toISOString();
const H = 3_600_000;
const D = 86_400_000;

function item(p: Partial<TodayItem> & Pick<TodayItem, 'key' | 'lane' | 'name' | 'colour'>): TodayItem {
  return {
    verb: 'REPLY', tier: Tier.Waiting, why: p.name, to: '/', source: null,
    daysSinceOut: null, quietDays: 0, carriedDays: 0, sinceAt: null, ...p,
  };
}

const ALL_ORDER = ['Cs Over', 'Proof Over', 'Sales Over', 'Sales Red', 'Proof Amber', 'Cs Blue'];

function chip(root: ParentNode, id: string): HTMLButtonElement {
  const el = root.querySelector(`[data-testid="today-chip-${id}"]`);
  if (!el) throw new Error(`missing chip ${id}`);
  return el as HTMLButtonElement;
}
function names(root: ParentNode): string[] {
  return [...root.querySelectorAll('[data-testid="today-row"]')].map((el) => el.querySelector('.font-head')?.textContent ?? '');
}

describe('TodayPage', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    bag.sales = [
      item({ key: 's-red', lane: 'Sales', name: 'Sales Red', colour: 'red', lastInAt: ago(H) }),
      item({ key: 's-over', lane: 'Sales', name: 'Sales Over', colour: 'amber', lastInAt: ago(10 * D) }),
    ];
    bag.cs = [
      item({ key: 'c-blue', lane: 'CS', name: 'Cs Blue', colour: 'blue', lastInAt: ago(H) }),
      item({ key: 'c-over', lane: 'CS', name: 'Cs Over', colour: 'red', lastInAt: ago(10 * D) }),
    ];
    bag.proofs = [
      { key: 'p-amber', lane: 'Proofs', name: 'Proof Amber', verb: 'Send proof', colour: 'amber', tier: Tier.WaitingOnUs, why: 'Proof ready', to: '/', lastInAt: ago(H) },
      { key: 'p-over', lane: 'Proofs', name: 'Proof Over', verb: 'CHASE', colour: 'red', tier: Tier.Waiting, why: 'Family reviewing', to: '/', lastInAt: ago(10 * D) },
    ];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    host.remove();
    localStorage.clear();
  });

  async function render() {
    await act(async () => { root.render(<TodayPage />); });
    return host;
  }

  it('sorts All across lanes: overdue, then colour, then tier, then in-lane rank', async () => {
    const el = await render();
    expect(el.querySelector('[data-testid="today-header"]')?.tagName).toBe('H2');
    expect(el.querySelector('[data-testid="today-header"]')?.textContent).toBe('6 to do today');
    expect(names(el)).toEqual(ALL_ORDER);
    expect([...el.querySelectorAll('[data-testid="today-lane"]')].map((n) => n.textContent)).toEqual([
      'CS', 'Proofs', 'Sales', 'Sales', 'Proofs', 'CS',
    ]);
    expect(el.textContent).not.toContain('No message text stored');
  });

  it('shows an overdue dot on a lane chip, and the Proofs count', async () => {
    const el = await render();
    expect(chip(el, 'All').textContent?.replace(/\s+/g, ' ')).toContain('All 6');
    expect(chip(el, 'All').querySelector('[aria-label="has overdue"]')).toBeNull();
    expect(chip(el, 'Proofs').textContent?.replace(/\s+/g, ' ')).toContain('Proofs 2');
    expect(chip(el, 'Proofs').querySelector('[aria-label="has overdue"]')).not.toBeNull();
    expect(chip(el, 'Sales').querySelector('[aria-label="has overdue"]')).not.toBeNull();
    expect(chip(el, 'CS').querySelector('[aria-label="has overdue"]')).not.toBeNull();
    expect(chip(el, 'Permits').disabled).toBe(true);
    expect(chip(el, 'Permits').className).toContain('opacity-50');
    expect(chip(el, 'Permits').querySelector('[aria-label="has overdue"]')).toBeNull();
    expect(chip(el, 'Finance').disabled).toBe(true);
  });

  it('restores the view from localStorage and writes it back on change', async () => {
    localStorage.setItem('mason-today-view:org-1', 'Proofs');
    const el = await render();
    expect(chip(el, 'Proofs').getAttribute('aria-pressed')).toBe('true');
    expect(chip(el, 'All').getAttribute('aria-pressed')).toBe('false');
    expect(names(el)).toEqual(['Proof Amber', 'Proof Over']);
    expect(el.querySelectorAll('[data-testid="today-lane"]')).toHaveLength(0);
    await act(async () => { chip(el, 'All').click(); });
    expect(localStorage.getItem('mason-today-view:org-1')).toBe('All');
    expect(chip(el, 'All').getAttribute('aria-pressed')).toBe('true');
    expect(names(el)).toEqual(ALL_ORDER);
    expect(el.querySelectorAll('[data-testid="today-lane"]')).toHaveLength(6);
  });

  it('defaults to All when nothing is stored', async () => {
    const el = await render();
    expect(chip(el, 'All').getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('mason-today-view:org-1')).toBeNull();
  });
});
