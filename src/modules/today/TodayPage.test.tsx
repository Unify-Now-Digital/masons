/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Tier, type Lane, type TodayInput, type TodayItem } from './todayModel';
import { localDayKey } from './sessionDone';

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

function item(p: Partial<TodayItem> & Pick<TodayItem, 'key' | 'lane' | 'name'>): TodayItem {
  return {
    verb: 'REPLY', colour: 'red', tier: Tier.Waiting, why: p.name, to: '/', source: null,
    daysSinceOut: null, quietDays: 0, carriedDays: 0, sinceAt: null,
    kind: 'reply', bucket: 'today', waitingOn: 'us', waitingSince: new Date(bag.NOW), lateBy: 0,
    reasons: [{ text: p.name, source: { kind: 'rule', label: 'Business rule' } }],
    factors: ['Due today'], evidence: [{ source: { kind: 'rule', label: 'Business rule' }, at: new Date(bag.NOW), text: p.name }],
    short: 'message', ...p,
  };
}

function chip(root: ParentNode, id: string): HTMLButtonElement {
  const el = root.querySelector(`[data-testid="today-chip-${id}"]`);
  if (!el) throw new Error(`missing chip ${id}`);
  return el as HTMLButtonElement;
}
function row(root: ParentNode, name: string): HTMLButtonElement {
  const el = [...root.querySelectorAll('[data-testid="today-row"]')].find((n) => n.querySelector('.font-head')?.textContent === name);
  if (!el) throw new Error(`missing row ${name}`);
  return el as HTMLButtonElement;
}
function names(root: ParentNode): string[] {
  return [...root.querySelectorAll('[data-testid="today-row"]')].map((el) => el.querySelector('.font-head')?.textContent ?? '');
}
function groups(root: ParentNode): string[] {
  return [...root.querySelectorAll('[data-testid="today-section"]')].map((el) => el.getAttribute('data-group') ?? '');
}

const RANK = ['Sales Late', 'Cs Chase', 'Sales Today', 'Proof Today', 'Fix Record', 'Cs Old'];

describe('TodayPage queue (11b)', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    bag.sales = [
      item({ key: 's-late', lane: 'Sales', name: 'Sales Late', personId: 'p1', bucket: 'late', kind: 'reply', waitingOn: 'us', lateBy: 48, short: 'grey granite price', valueGbp: 5000 }),
      item({ key: 's-today', lane: 'Sales', name: 'Sales Today', personId: 'p2', bucket: 'today', kind: 'reply', waitingOn: 'us', lateBy: -3, short: 'fitted price', valueGbp: 100 }),
    ];
    bag.cs = [
      item({ key: 'c-old', lane: 'CS', name: 'Cs Old', personId: 'p3', bucket: 'old', kind: 'call', waitingOn: 'us', lateBy: 200, short: 'fixing date question', valueGbp: 10 }),
      item({ key: 'c-them', lane: 'CS', name: 'Cs Chase', personId: 'p1', bucket: 'late', kind: 'chase', waitingOn: 'them', lateBy: 30, short: 'permit with Sutton', valueGbp: 20 }),
    ];
    bag.proofs = [
      { key: 'p-today', lane: 'Proofs', name: 'Proof Today', personId: 'p-proof', verb: 'Send proof', colour: 'amber', tier: Tier.WaitingOnUs, why: 'permit form to sign', to: '/', lastInAt: ago(H), valueGbp: 50 },
      { key: 'f-fix', lane: 'Finance', name: 'Fix Record', personId: 'p-fix', verb: 'Record payment', colour: 'amber', tier: Tier.MoneyDue, why: 'deposit amount', to: '/', sinceAt: ago(H), valueGbp: 5 },
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

  it('groups by urgency: late, due today, records to fix, long overdue', async () => {
    const el = await render();
    expect(el.querySelector('[data-testid="today-header"]')?.tagName).toBe('H2');
    expect(el.querySelector('[data-testid="today-header"]')?.textContent).toBe('6 to do');
    expect(groups(el)).toEqual(['late', 'today', 'fix', 'old']);
    expect(names(el)).toEqual(RANK);
    expect(el.textContent).not.toContain('because');
    expect(el.textContent).not.toContain('SLA');
    expect(el.textContent).not.toContain('Open drafted');
    expect(el.querySelector('[aria-label="has overdue"]')).toBeNull();
  });

  it('tones each bucket, and counts late rows on the lane chip', async () => {
    const el = await render();
    expect(row(el, 'Sales Late').getAttribute('data-tone')).toBe('late-us');
    expect(row(el, 'Sales Late').querySelector('[data-testid="today-chip"]')?.className).toContain('bg-gardens-na-red-lt');
    expect(row(el, 'Sales Late').querySelector('[data-testid="today-timing"]')?.textContent).toBe('2d late');
    expect(row(el, 'Cs Chase').getAttribute('data-tone')).toBe('late-them');
    expect(row(el, 'Cs Chase').querySelector('[data-testid="today-chip"]')?.className).toContain('bg-gardens-na-blue-lt');
    expect(row(el, 'Sales Today').getAttribute('data-tone')).toBe('today');
    expect(row(el, 'Sales Today').querySelector('[data-testid="today-timing"]')?.textContent).toBe('3h left');
    expect(row(el, 'Proof Today').getAttribute('data-tone')).toBe('today');
    expect(row(el, 'Fix Record').getAttribute('data-tone')).toBe('fix');
    expect(row(el, 'Fix Record').querySelector('[data-testid="today-chip"]')?.className).toContain('border-dashed');
    expect(row(el, 'Fix Record').querySelector('[data-testid="today-timing"]')?.textContent).toBe('Record');
    expect(row(el, 'Cs Old').getAttribute('data-tone')).toBe('old');
    expect(chip(el, 'All').textContent).toContain('· 3 late');
    expect(chip(el, 'Sales').textContent).toContain('· 1 late');
    expect(chip(el, 'CS').textContent).toContain('· 2 late');
    expect(chip(el, 'Proofs').textContent).not.toContain('late');
    expect(chip(el, 'Finance').textContent).not.toContain('late');
    expect(chip(el, 'Permits').disabled).toBe(true);
    expect(chip(el, 'Permits').querySelector('[data-testid="today-late"]')).toBeNull();
  });

  it('restores the lane and writes it back', async () => {
    localStorage.setItem('mason-today-view:org-1', 'Proofs');
    const el = await render();
    expect(chip(el, 'Proofs').getAttribute('aria-pressed')).toBe('true');
    expect(names(el)).toEqual(['Proof Today']);
    expect(groups(el)).toEqual(['today']);
    await act(async () => { chip(el, 'All').click(); });
    expect(localStorage.getItem('mason-today-view:org-1')).toBe('All');
    expect(names(el)).toEqual(RANK);
  });

  it('defaults the lane and the group when nothing is stored', async () => {
    const el = await render();
    expect(chip(el, 'All').getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('mason-today-view:org-1')).toBeNull();
    expect((el.querySelector('[data-testid="today-group"]') as HTMLSelectElement).value).toBe('urgency');
    expect(localStorage.getItem('mason-today-group:org-1')).toBeNull();
  });

  it('persists the group-by setting and regroups the rows', async () => {
    localStorage.setItem('mason-today-group:org-1', 'lane');
    const el = await render();
    const select = el.querySelector('[data-testid="today-group"]') as HTMLSelectElement;
    expect(select.value).toBe('lane');
    expect(groups(el)).toEqual(['Sales', 'CS', 'Proofs', 'Finance']);
    await act(async () => {
      select.value = 'person';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(localStorage.getItem('mason-today-group:org-1')).toBe('person');
    expect(groups(el)).toEqual(['p1', 'p2', 'p-proof', 'p-fix', 'p3']);
    expect(el.querySelector('[data-group="p1"]')?.getAttribute('data-count')).toBe('2');
    expect(names(el).slice(0, 2)).toEqual(['Sales Late', 'Cs Chase']);
  });

  it('sets aria-current on the selected row', async () => {
    const el = await render();
    expect(row(el, 'Sales Late').getAttribute('aria-current')).toBeNull();
    await act(async () => { row(el, 'Sales Today').click(); });
    expect(row(el, 'Sales Today').getAttribute('aria-current')).toBe('true');
    expect(row(el, 'Sales Late').getAttribute('aria-current')).toBeNull();
    expect(row(el, 'Sales Today').className).toContain('bg-[#F4F6FB]');
  });

  it('shows a done row from this session and drops it after midnight', async () => {
    const day = localDayKey(new Date(bag.NOW));
    localStorage.setItem('mason-today-done:org-1', JSON.stringify({ day, items: { 's-late': 'Sent' } }));
    const el = await render();
    expect(el.querySelector('[data-testid="today-header"]')?.textContent).toBe('5 to do');
    expect(el.querySelector('[data-testid="today-done"]')?.textContent).toBe('1 done');
    expect(row(el, 'Sales Late').getAttribute('data-tone')).toBe('done');
    expect(row(el, 'Sales Late').querySelector('[data-testid="today-chip"]')?.textContent).toContain('Done');
    expect(row(el, 'Sales Late').querySelector('[data-testid="today-timing"]')?.textContent).toBe('Sent');
    expect(row(el, 'Sales Late').textContent).not.toContain('Ready');
  });
});
