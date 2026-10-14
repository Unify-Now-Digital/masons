import { describe, expect, it } from 'vitest';
import {
  ageBucket, ageDays, agedOwed, cashByWeek, chaseQueue, csvSafe, dedupePayments, financeNeedsYou, countThisVsLast, dueOnCompletion, installTray, noPaymentOrders,
  sumThisVsLast, toCsv, topTodos, weekBoard, weekStart, type OwedInvoice, type SectionOrder,
  localDay,
  localKey,
} from './sectionsView';

const NOW = new Date('2026-10-14T10:00:00'); // Wednesday
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const inv = (id: string, days: number, pence: number, status = 'pending'): OwedInvoice => ({
  id, invoiceNumber: id, orderId: null, customer: id, issueDate: ago(days), remainingPence: pence, status,
});
const ord = (id: string, p: Partial<SectionOrder>): SectionOrder => ({
  id, ref: id, customer: id, forName: null, location: null, jobStage: 'confirmed', jobPaidAt: null, jobExitReason: null,
  depositDate: null, secondPaymentDate: null, stoneStatus: 'Ordered', permitStatus: 'not_started', proofStatus: 'Not_Received',
  installationDate: null, total: 0, amountPaidPence: null, remainingPence: null, hasInvoice: false, ...p,
});

describe('finance', () => {
  it('ages owed money; paid and void are excluded', () => {
    const a = agedOwed([inv('a', 151, 392000), inv('b', 40, 301920), inv('c', 10, 265500), inv('d', 2, 100), inv('e', 200, 999, 'void'), inv('f', 5, 0, 'paid')], NOW);
    expect(a).toEqual({ d90: 3920, d31to90: 3019.2, d8to30: 2655, d0to7: 1, noDate: 0 });
  });
  it('no issue date goes to its own bucket, not 0–7 days', () => {
    const a = agedOwed([{ ...inv('x', 0, 5000), issueDate: null }], NOW);
    expect(a.noDate).toBe(50);
    expect(a.d0to7).toBe(0);
  });
  it('90 days is "90+"; ages use local calendar days for date-only values', () => {
    expect(ageBucket(90)).toBe('d90');
    expect(ageBucket(89)).toBe('d31to90');
    expect(ageBucket(null)).toBe('noDate');
    expect(ageDays('2026-10-13', new Date(2026, 9, 14, 0, 30))).toBe(1);
    expect(ageDays('2026-10-14', new Date(2026, 9, 14, 23, 59))).toBe(0);
  });
  it('chase queue: overdue by due date first (most overdue first), not-due kept apart', () => {
    const q = chaseQueue(
      [
        { ...inv('notDue', 3, 1), dueDate: '2026-10-28' },
        { ...inv('late5', 40, 1), dueDate: '2026-10-09' },
        { ...inv('late30', 10, 1), dueDate: '2026-09-14' },
        { ...inv('noDue', 90, 1), dueDate: null },
        { ...inv('placeholder', 2, 1), dueDate: '2199-01-01' },
      ],
      NOW,
    );
    expect(q.map((r) => r.id)).toEqual(['late30', 'late5', 'noDue', 'placeholder']);
    expect(q[0]!.overdueDays).toBe(30);
    expect(q.notDue.map((r) => r.id)).toEqual(['notDue']);
  });
  it('Finance tab and Hub tile share one "needs you" count', () => {
    const f = financeNeedsYou(
      [{ ...inv('a', 40, 1000), dueDate: '2026-10-01' }, { ...inv('b', 1, 2000), dueDate: '2026-11-01' }, inv('c', 5, 0, 'paid')],
      [ord('o', {})],
      NOW,
    );
    expect(f).toMatchObject({ count: 2, owedCount: 2, owedTotal: 30 });
  });
  it('one payment counted once across order_payments and invoice_payments', () => {
    const out = dedupePayments([
      [{ amount: 120, at: ago(0), ids: ['op:1', 'pi_123'] }, { amount: 50, at: ago(0), ids: ['op:2', 'revolut_9'] }],
      [{ amount: 120, at: ago(0), ids: ['ip:1', 'pi_123', 'ch_1'] }, { amount: 75, at: ago(1), ids: ['ip:2', 'pi_456', 'ch_2'] }],
    ]);
    expect(out.map((p) => p.amount)).toEqual([120, 50, 75]);
  });
  it('cash per week buckets by Monday', () => {
    expect(weekStart(NOW).getDay()).toBe(1);
    const w = cashByWeek([{ amount: 1500, at: ago(0) }, { amount: 1943, at: ago(9) }, { amount: 5, at: ago(60) }], 3, NOW);
    expect(w.map((x) => x.collected)).toEqual([0, 1943, 1500]);
    expect(w[2]!.current).toBe(true);
  });
  it('csv quotes commas and quotes', () => {
    expect(toCsv(['a', 'b'], [['x, y', 'say "hi"'], [1, null]])).toBe('\uFEFFa,b\r\n"x, y","say ""hi"""\r\n1,');
  });
  it('csv neutralises formula cells (= + - @ tab CR) but not numbers', () => {
    expect(csvSafe('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(csvSafe('+44 7700')).toBe(`'+44 7700`);
    expect(csvSafe('-1')).toBe(`'-1`);
    expect(csvSafe('@SUM(A1)')).toBe(`'@SUM(A1)`);
    expect(csvSafe('\tx')).toBe(`'\tx`);
    expect(csvSafe(-12.5)).toBe('-12.5');
    expect(csvSafe('£120 Smith')).toBe('£120 Smith');
    expect(toCsv(['n'], [['=1+1']])).toBe("\uFEFFn\r\n'=1+1");
  });
  it('request deposit only for confirmed+ orders with no payment and no invoice', () => {
    const list = [ord('a', {}), ord('b', { depositDate: '2026-10-01' }), ord('c', { hasInvoice: true }), ord('d', { jobStage: 'quoted' })];
    expect(noPaymentOrders(list).map((o) => o.id)).toEqual(['a']);
  });
  it('balance on completion = the invoice remaining (pence), not order total − paid', () => {
    // Pence-sized fixtures: £120 deposit (12000p) paid, invoice remaining £2,250.40 (225040p); order total differs (2500).
    const r = dueOnCompletion([
      ord('a', { hasInvoice: true, total: 2500, amountPaidPence: 12000, remainingPence: 225040 }),
      ord('b', { jobPaidAt: 'x', total: 100 }),
      ord('c', { depositDate: '2026-10-10', hasInvoice: true, total: 900, amountPaidPence: 0, remainingPence: null }),
    ]);
    expect(r.map((o) => o.balance)).toEqual([2250.4, 100, null]);
    expect(r.map((o) => o.balanceEstimated)).toEqual([false, true, false]);
  });
  it('a £120 deposit in pence counts as a deposit', () => {
    expect(noPaymentOrders([ord('a', { amountPaidPence: 12000, hasInvoice: false })])).toEqual([]);
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
  it('timestamps land on their Europe/London day, whatever the device zone', () => {
    expect(localKey(localDay('2026-10-14T23:30:00Z'))).toBe('2026-10-15');
    expect(localKey(localDay('2026-12-14T23:30:00Z'))).toBe('2026-12-14');
  });
  it('week board puts bookings on their day', () => {
    const b = weekBoard([ord('x', { installationDate: '2026-10-14' }), ord('y', { installationDate: '2026-10-14T23:30:00Z' /* 00:30 BST on 15 Oct in London */ })], weekStart(NOW));
    expect(b.map((d) => d.bookings.length)).toEqual([0, 0, 1, 1, 0]);
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
