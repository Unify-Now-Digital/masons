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
vi.mock('./todaySend', () => ({ sendPreparedMessage: vi.fn(async () => {}) }));

import { primeDraft } from '@/modules/inbox/utils/primedDraft';
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

const RANK = ['Sales Late', 'Sales Today', 'Proof Today', 'Fix Record', 'Cs Old'];

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
    expect(el.querySelector('[data-testid="today-header"]')?.textContent).toBe('5 to do');
    expect(row(el, 'Sales Late').getAttribute('data-relation')).toBe('enquiry');
    expect([...row(el, 'Sales Late').querySelectorAll('[data-testid="today-task"]')].map((n) => n.getAttribute('data-mark'))).toEqual(['message', 'order']);
    expect(el.querySelector('[data-testid="today-also"]')?.textContent).toContain('permit with Sutton');
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
    expect(row(el, 'Sales Late').querySelector('[data-testid="today-timing"]')?.textContent).toBe('2d late');
    expect(row(el, 'Sales Today').getAttribute('data-tone')).toBe('today');
    expect(row(el, 'Sales Today').querySelector('[data-testid="today-timing"]')?.textContent).toBe('3h left');
    expect(row(el, 'Proof Today').getAttribute('data-tone')).toBe('today');
    expect(row(el, 'Fix Record').getAttribute('data-tone')).toBe('fix');
    expect(row(el, 'Fix Record').querySelector('[data-testid="today-timing"]')?.textContent).toBe('Record');
    expect(row(el, 'Cs Old').getAttribute('data-tone')).toBe('old');
    expect(chip(el, 'All').textContent).toContain('· 2 late');
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
    expect(groups(el)).toEqual([]);
    expect(names(el)).toEqual(RANK);
    expect(row(el, 'Sales Late').querySelectorAll('[data-testid="today-task"]')).toHaveLength(2);
  });

  it('sets aria-current on the selected row', async () => {
    const el = await render();
    expect(row(el, 'Sales Late').getAttribute('aria-current')).toBe('true');
    expect(row(el, 'Sales Late').className).toContain('bg-gardens-acc-lt');
    await act(async () => { row(el, 'Sales Today').click(); });
    expect(row(el, 'Sales Today').getAttribute('aria-current')).toBe('true');
    expect(row(el, 'Sales Late').getAttribute('aria-current')).toBeNull();
  });

  it('shows a done row from this session and drops it after midnight', async () => {
    const day = localDayKey(new Date(bag.NOW));
    localStorage.setItem('mason-today-done:org-1', JSON.stringify({ day, items: { 's-late': 'Sent', 'c-them': 'Chased' } }));
    const el = await render();
    expect(el.querySelector('[data-testid="today-header"]')?.textContent).toBe('4 to do');
    expect(el.querySelector('[data-testid="today-done"]')?.textContent).toBe('1 done');
    expect(row(el, 'Sales Late').getAttribute('data-tone')).toBe('done');
    expect(row(el, 'Sales Late').querySelector('[data-testid="today-timing"]')?.textContent).toBe('Sent');
    expect(row(el, 'Sales Late').textContent).not.toContain('Ready');
  });

  it('moves between people with j and k, and ignores those keys in the group control', async () => {
    const el = await render();
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true })); });
    expect(row(el, 'Sales Today').getAttribute('aria-current')).toBe('true');
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true })); });
    expect(row(el, 'Sales Late').getAttribute('aria-current')).toBe('true');
    const select = el.querySelector('[data-testid="today-group"]') as HTMLSelectElement;
    await act(async () => { select.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true })); });
    expect(row(el, 'Sales Late').getAttribute('aria-current')).toBe('true');
  });

  it('prepares the most urgent task first and opens the next one from the stack', async () => {
    const el = await render();
    const detail = el.querySelector('[data-testid="today-detail"]');
    expect(detail?.querySelector('h2')?.textContent).toBe('Sales Late');
    expect(detail?.querySelector('[aria-label="Close"]')?.className).toContain('h-11');
    expect(detail?.querySelector('[data-section="prepared"]')?.className).toContain('flex-1');
    expect(detail?.querySelector('[data-testid="today-draft"]')).not.toBeNull();
    expect(detail?.textContent).toContain('check before sending');
    const also = el.querySelector('[data-testid="today-also"] button') as HTMLButtonElement;
    await act(async () => { also.click(); });
    expect(el.querySelector('[data-testid="today-detail"] h2')?.textContent).toBe('Cs Chase');
    expect(el.querySelector('[data-testid="today-rank"]')?.textContent).toBe('#1 of 5');
  });

  it('toasts a call outcome and selects the next open person', async () => {
    const el = await render();
    await act(async () => { row(el, 'Cs Old').click(); });
    const primary = el.querySelector('[data-testid="today-primary"]') as HTMLButtonElement;
    expect(primary.textContent).toContain('Logged & next');
    expect(el.querySelector('[data-testid="today-detail"]')?.textContent).not.toContain('check before sending');
    await act(async () => { primary.click(); });
    expect(el.querySelector('[data-testid="today-toast"]')?.textContent).toBe('Called: Cs Old · next: Sales Late');
    expect(row(el, 'Sales Late').getAttribute('aria-current')).toBe('true');
    expect(row(el, 'Cs Old').getAttribute('data-tone')).toBe('done');
  });

  it('opens the first person who already has a prepared action', async () => {
    primeDraft('bad', 'Please pay £999 today.');
    bag.sales = [
      item({ key: 'bad', lane: 'Sales', name: 'No Draft', personId: 'p-bad', conversationId: 'bad', channel: 'email', bucket: 'late', kind: 'reply', short: 'priced draft' }),
      item({ key: 'ok', lane: 'Sales', name: 'Has Draft', personId: 'p-ok', bucket: 'today', kind: 'reply', channel: 'email', short: 'quote follow-up' }),
    ];
    bag.cs = [];
    bag.proofs = [];
    const el = await render();
    expect(row(el, 'Has Draft').getAttribute('aria-current')).toBe('true');
    expect(el.querySelector('[data-testid="today-detail"]')?.textContent).not.toContain('Nothing is prepared');
    expect(el.querySelector('[data-testid="today-primary"]')?.textContent).toContain('Send & next');
  });

  it('marks a ledger row as system and keeps the list in the page scroll', async () => {
    bag.sales = [];
    bag.cs = [];
    bag.proofs = [
      { key: 'fin:void-in-stripe', lane: 'Finance', name: '10 invoices void in Stripe', verb: 'FLAG', colour: 'amber', tier: Tier.MoneyDue, why: 'Pending in Mason but void in Stripe', to: '/dashboard/finance?tab=reconcile', valueGbp: 10 },
    ];
    const el = await render();
    const system = row(el, '10 invoices void in Stripe');
    expect(system.getAttribute('data-relation')).toBe('system');
    expect(system.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('[data-testid="today-chips"]')?.className).toContain('flex-wrap');
    expect(el.querySelector('[data-testid="today-chips"]')?.className).not.toContain('overflow-x-auto');
    expect(el.querySelector('[data-testid="today-list"]')?.className).toContain('overflow-x-hidden');
    expect(el.querySelector('[data-testid="today-list"]')?.className ?? '').not.toContain('overflow-y-auto');
    expect(el.querySelector('[data-testid="today-legend"]')?.className).not.toContain('shrink-0');
    expect(system.className).toContain('min-h-11');
    expect(el.querySelector('[data-testid="today-primary"]')?.className).toContain('min-h-11');
  });

  it('hides a one-task person until tomorrow', async () => {
    const el = await render();
    await act(async () => { row(el, 'Sales Today').click(); });
    await act(async () => { (el.querySelector('[data-testid="today-tomorrow"]') as HTMLButtonElement).click(); });
    expect(names(el)).not.toContain('Sales Today');
    expect(el.querySelector('[data-testid="today-header"]')?.textContent).toBe('4 to do');
  });
});
