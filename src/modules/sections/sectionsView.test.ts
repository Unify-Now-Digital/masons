import { describe, expect, it } from 'vitest';
import {
  agedOwed, cashByWeek, chaseQueue, countThisVsLast, dueOnCompletion, installTray, noPaymentOrders,
  sumThisVsLast, toCsv, topTodos, weekBoard, weekStart, type OwedInvoice, type SectionOrder,
} from './sectionsView';

const NOW = new Date('2026-10-14T10:00:00'); // Wednesday
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const inv = (id: string, days: number, pence: number, status = 'pending'): OwedInvoice => ({
  id, invoiceNumber: id, orderId: null, customer: id, issueDate: ago(days), remainingPence: pence, status,
});
const ord = (id: string, p: Partial<SectionOrder>): SectionOrder => ({
  id, ref: id, customer: id, forName: null, location: null, jobStage: 'confirmed', jobPaidAt: null, jobExitReason: null,
  depositDate: null, secondPaymentDate: null, stoneStatus: 'Ordered', permitStatus: 'not_started', proofStatus: 'Not_Received',
  installationDate: null, total: 0, amountPaid: null, hasInvoice: false, ...p,
});

describe('finance', () => {
  it('ages owed money; paid and void are excluded', () => {
    const a = agedOwed([inv('a', 151, 392000), inv('b', 40, 301920), inv('c', 10, 265500), inv('d', 2, 100), inv('e', 200, 999, 'void'), inv('f', 5, 0, 'paid')], NOW);
    expect(a).toEqual({ d90: 3920, d31to90: 3019.2, d8to30: 2655, d0to7: 1 });
  });
  it('chase queue is oldest first', () => {
    expect(chaseQueue([inv('a', 3, 1), inv('b', 90, 1), inv('c', 10, 1)], NOW).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
  it('cash per week buckets by Monday', () => {
    expect(weekStart(NOW).getDay()).toBe(1);
    const w = cashByWeek([{ amount: 1500, at: ago(0) }, { amount: 1943, at: ago(9) }, { amount: 5, at: ago(60) }], 3, NOW);
    expect(w.map((x) => x.collected)).toEqual([0, 1943, 1500]);
    expect(w[2]!.current).toBe(true);
  });
  it('csv quotes commas and quotes', () => {
    expect(toCsv(['a', 'b'], [['x, y', 'say "hi"'], [1, null]])).toBe('a,b\r\n"x, y","say ""hi"""\r\n1,');
  });
  it('request deposit only for confirmed+ orders with no payment and no invoice', () => {
    const list = [ord('a', {}), ord('b', { depositDate: '2026-10-01' }), ord('c', { hasInvoice: true }), ord('d', { jobStage: 'quoted' })];
    expect(noPaymentOrders(list).map((o) => o.id)).toEqual(['a']);
  });
  it('balance on completion uses the invoice amount paid, else unknown', () => {
    const r = dueOnCompletion([ord('a', { depositDate: '2026-10-10', total: 2370.4, amountPaid: 1500 }), ord('b', { jobPaidAt: 'x', total: 100 })]);
    expect(r.map((o) => o.balance)).toEqual([870.4, null]);
  });
});

describe('install planner', () => {
  const ready = { stoneStatus: 'In Stock', permitStatus: 'approved', proofStatus: 'Lettered' };
  it('tray = ready and unbooked; deposit decides ready vs blocked', () => {
    const t = installTray([
      ord('a', { ...ready, depositDate: '2026-09-01' }),
      ord('b', { ...ready }),
      ord('c', { ...ready, depositDate: '2026-09-01', installationDate: '2026-10-20' }),
      ord('d', { depositDate: '2026-09-01' }),
    ]);
    expect(t.ready.map((o) => o.id)).toEqual(['a']);
    expect(t.blocked.map((o) => o.id)).toEqual(['b']);
  });
  it('week board puts bookings on their day', () => {
    const b = weekBoard([ord('x', { installationDate: '2026-10-14' })], weekStart(NOW));
    expect(b.map((d) => d.bookings.length)).toEqual([0, 0, 1, 0, 0]);
  });
});

describe('hub', () => {
  it('this week vs last', () => {
    expect(countThisVsLast([ago(0), ago(1), ago(4), ago(8), ago(30), null], NOW)).toEqual({ thisWeek: 2, lastWeek: 2 });
    expect(sumThisVsLast([{ amount: 10, at: ago(0) }, { amount: 5.5, at: ago(5) }], NOW)).toEqual({ thisWeek: 10, lastWeek: 5.5 });
  });
  it('top to-dos by rank', () => {
    const a = { kind: 'permit', label: '', reason: '', tone: 'red' } as const;
    const items = [1, 5, 3, 9].map((r) => ({ key: String(r), section: 'Orders' as const, name: '', why: '', action: a, to: '', rank: r }));
    expect(topTodos(items).map((i) => i.key)).toEqual(['9', '5', '3']);
  });
});
