import { describe, expect, it } from 'vitest';
import { kindFor, type ActionKind } from './actionKind';
import type { BrandData, JobRow, OrderRow, PermitRow } from './brandData.types';
import { hubLaneItems } from './sharedLanes';
import { csItems, financeItems, permitItems, salesItems } from './todayRules';
import { applyFacts, ballOnUs, buildToday, groupByPerson, headerText, LANE_CAPS, rankToday, Tier, trimQuote, updateSeen, type TodayInput, type Verb } from './todayModel';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const mk = (k: string, p: Partial<TodayInput> = {}): TodayInput => ({
  key: k, lane: 'Sales', name: k, verb: 'REPLY', colour: 'red', tier: Tier.Waiting, why: '', to: '/', sinceAt: ago(1), ...p,
});

describe('todayModel', () => {
  it('ranks: issue/date > waiting on us > money > new enquiry > quiet quote (by value) > waiting > hold', () => {
    const p = buildToday([
      mk('hold', { tier: Tier.OnHold }), mk('q-small', { tier: Tier.QuietQuote, valueGbp: 900 }), mk('q-big', { tier: Tier.QuietQuote, valueGbp: 5000 }),
      mk('new', { tier: Tier.NewEnquiry }), mk('money', { tier: Tier.MoneyDue }), mk('wait', { tier: Tier.WaitingOnUs }), mk('date', { tier: Tier.IssueOrHardDate }),
    ], NOW);
    expect(p.today.Sales.map((i) => i.key)).toEqual(['date', 'wait', 'money', 'new', 'q-big', 'q-small', 'hold']);
  });
  it('caps per lane and keeps the rest for later', () => {
    const items = Array.from({ length: 40 }, (_, n) => mk(`s${n}`));
    const p = buildToday([...items, ...Array.from({ length: 9 }, (_, n) => mk(`f${n}`, { lane: 'Finance' }))], NOW);
    expect(p.today.Sales).toHaveLength(LANE_CAPS.Sales);
    expect(p.later.Sales).toHaveLength(25);
    expect(p.today.Finance).toHaveLength(5);
    expect(p.toDo).toBe(20);
  });
  it('quiet 60+ → Abandoned?, 90+ → close or re-quote, never on Today; hard dates stay', () => {
    const p = buildToday([
      mk('a', { staleable: true, sinceAt: ago(70) }), mk('c', { staleable: true, sinceAt: ago(120), lastOutAt: ago(95) }),
      mk('fresh', { staleable: true, lastInAt: ago(3) }), mk('d', { staleable: true, sinceAt: ago(200), tier: Tier.IssueOrHardDate }),
    ], NOW);
    expect(p.abandoned.map((i) => i.key)).toEqual(['a']);
    expect(p.closeOrRequote.map((i) => i.key)).toEqual(['c']);
    expect(p.today.Sales.map((i) => i.key).sort()).toEqual(['d', 'fresh']);
  });
  it('carried-over day count from the first-seen map, and plain header text', () => {
    const p1 = buildToday([mk('x'), mk('y')], NOW);
    const seen = updateSeen({}, p1, NOW - 2 * 86_400_000);
    const p2 = buildToday([mk('x'), mk('y'), mk('z')], NOW, seen);
    expect(p2.today.Sales.find((i) => i.key === 'x')!.carriedDays).toBe(2);
    expect(p2.carried).toBe(2);
    expect(headerText(p2)).toBe('3 to do today · 2 carried over');
  });
  it('caps the Proofs lane at 10', () => {
    const items = Array.from({ length: 12 }, (_, n) => mk(`p${n}`, { lane: 'Proofs', verb: 'Send proof' }));
    const p = buildToday(items, NOW);
    expect(LANE_CAPS.Proofs).toBe(10);
    expect(p.today.Proofs).toHaveLength(10);
    expect(p.later.Proofs).toHaveLength(2);
    expect(p.today.CS).toHaveLength(0);
  });
  it('routes a ready proof onto the Proofs lane', () => {
    const order: OrderRow = {
      id: 'o1', order_number: 1, customer_name: 'C o1', person_name: null, person_id: null, job_id: null,
      value: 2000, permit_cost: 0, deposit_date: null, second_payment_date: null, installation_date: null,
      stone_status: 'NA', inscription_status: 'pending', proof_status: 'Received', invoice_id: null,
      created_at: ago(10), is_test: false, job: { stage: 'confirmed', exit_reason: null, paid_at: null },
    };
    const d: BrandData = { jobs: [], orders: [order], convs: [], permits: [], orderPayments: [], invoices: [], invoicePayments: [] };
    const items = csItems(d, NOW);
    expect(items.map((i) => [i.lane, i.verb, i.why])).toEqual([['Proofs', 'Send proof', 'Proof ready to send to the family']]);
    const p = buildToday(items, NOW);
    expect(p.today.Proofs.map((i) => i.key)).toEqual(['cs-proof:o1']);
    expect(p.today.CS).toHaveLength(0);
  });
  it('ball on us only when they wrote after our last message out', () => {
    expect(ballOnUs(ago(1), ago(2))).toBe(true);
    expect(ballOnUs(ago(2), ago(1))).toBe(false);
    expect(ballOnUs(ago(2), null)).toBe(true);
    expect(ballOnUs(null, ago(1))).toBe(false);
  });
});

const EXPECTED_KIND = {
  REPLY: 'reply',
  CALL: 'call',
  CHASE: 'chase',
  QUOTE: 'send',
  INVOICE: 'send',
  'SOFT FUP': 'chase',
  CONFIRM: 'reply',
  'Send form': 'send',
  'Send proof': 'send',
  'Acknowledge form': 'reply',
  'Submit & pay fee': 'send',
  'Match payment': 'fix',
  'Request balance': 'send',
  'Record payment': 'fix',
  FLAG: 'fix',
  WAIT: 'chase',
  Reply: 'reply',
  Call: 'call',
  Chase: 'chase',
  'Make first contact': 'reply',
  'Waiting on deposit': 'chase',
  'Chase deposit': 'chase',
  'Waiting on them': 'chase',
  'Gentle follow-up': 'chase',
  'Send quote': 'send',
  Waiting: 'chase',
  'Request deposit': 'send',
} as const satisfies Record<Verb, ActionKind>;

describe('action kinds, buckets and rank (11a)', () => {
  const hoursBefore = (h: number, extraMs = 0) => new Date(NOW - h * 3_600_000 - extraMs).toISOString();
  const atHours = (hours: number, p: Partial<TodayInput> = {}) =>
    buildToday([mk('k', { lastInAt: hoursBefore(hours), sinceAt: null, ...p })], NOW).today.Sales[0];

  it('maps every verb, and does not promote a reply that is not past 7 days', () => {
    for (const verb of Object.keys(EXPECTED_KIND) as Verb[]) {
      expect(kindFor({ verb, lateBy: 0 })).toBe(EXPECTED_KIND[verb]);
      expect(kindFor({ verb, lateBy: 168 })).toBe(EXPECTED_KIND[verb]);
    }
  });

  it('turns a reply into a call once it is more than 7 days late', () => {
    expect(kindFor({ verb: 'REPLY', lateBy: 169 })).toBe('call');
    expect(kindFor({ verb: 'Reply', lateBy: 169 })).toBe('call');
    expect(kindFor({ verb: 'Make first contact', lateBy: 200 })).toBe('call');
    expect(kindFor({ verb: 'CHASE', lateBy: 400 })).toBe('chase');
    expect(kindFor({ verb: 'CALL', lateBy: 400 })).toBe('call');
  });

  it('buckets 0h, 1h, 168h and 169h late on the Sales clock (24h)', () => {
    expect(atHours(24)).toMatchObject({ lateBy: 0, bucket: 'today', kind: 'reply', waitingOn: 'us' });
    expect(atHours(25)).toMatchObject({ lateBy: 1, bucket: 'late', kind: 'reply' });
    expect(atHours(24 + 168)).toMatchObject({ lateBy: 168, bucket: 'late', kind: 'reply' });
    expect(atHours(24 + 169)).toMatchObject({ lateBy: 169, bucket: 'old', kind: 'call', waitingOn: 'us' });
    expect(atHours(100, { verb: 'Record payment' })).toMatchObject({ bucket: 'fix', kind: 'fix', waitingOn: 'record' });
    expect(atHours(30, { verb: 'CHASE' })).toMatchObject({ bucket: 'late', kind: 'chase', waitingOn: 'them' });
  });

  it('ranks late, today, fix, old, then lateness, value and oldest waiting', () => {
    const row = (key: string, ageHours: number, extraMs: number, p: Partial<TodayInput>) =>
      buildToday([mk(key, { lastInAt: hoursBefore(ageHours, extraMs), sinceAt: null, lane: p.lane ?? 'Sales', ...p })], NOW).today[p.lane ?? 'Sales'][0];
    const items = [
      row('late-lo', 74, 0, { valueGbp: 1, verb: 'REPLY' }),
      row('today-later', 14, 0, { valueGbp: 99_999, verb: 'REPLY' }),
      row('old-small', 24 + 170, 0, { valueGbp: 9_000, verb: 'REPLY' }),
      row('fix', 10, 0, { verb: 'Record payment', lane: 'Finance', valueGbp: 50 }),
      row('late-hi-new', 74, 0, { valueGbp: 500, verb: 'REPLY' }),
      row('today-soon', 23, 0, { valueGbp: 1, verb: 'REPLY' }),
      row('old-big', 24 + 200, 0, { valueGbp: 1, verb: 'REPLY' }),
      row('late-hi-old', 74, 120_000, { valueGbp: 500, verb: 'REPLY' }),
    ];
    expect(rankToday(items, NOW).map((i) => i.key)).toEqual([
      'late-hi-old', 'late-hi-new', 'late-lo',
      'today-soon', 'today-later',
      'fix',
      'old-big', 'old-small',
    ]);
    expect(rankToday([], Number.NaN)).toEqual([]);
  });

  it('groups by person in rank order, and keeps a row with no person on its own', () => {
    const row = (key: string, ageHours: number, p: Partial<TodayInput>) =>
      buildToday([mk(key, { lastInAt: hoursBefore(ageHours), sinceAt: null, ...p })], NOW).today.Sales[0];
    const groups = groupByPerson([
      row('soon', 20, { personId: 'p', verb: 'REPLY', valueGbp: 10 }),
      row('late', 40, { personId: 'p', verb: 'REPLY', valueGbp: 10 }),
      row('other', 50, { personId: 'q', verb: 'CHASE', valueGbp: 10 }),
      row('lone', 30, { verb: 'REPLY', valueGbp: 1 }),
    ]);
    expect(groups.map((g) => [g.personId, g.items.map((i) => i.key)])).toEqual([
      ['q', ['other']],
      ['p', ['late', 'soon']],
      [null, ['lone']],
    ]);
  });

  it('quotes at most 240 characters', () => {
    expect(trimQuote('  hello  ')).toBe('hello');
    const long = 'a'.repeat(300);
    expect(trimQuote(long)).toHaveLength(240);
    expect(trimQuote(long).endsWith('…')).toBe(true);
    const item = applyFacts(mk('q', { snippet: long, channel: 'email', lastInAt: ago(0), conversationId: 'c' }), NOW);
    expect(item.evidence?.[0]).toMatchObject({ quote: true, text: trimQuote(long) });
    expect(item.evidence?.[0].href).toBe('/dashboard/inbox?conversation=c');
    expect(item.reasons?.every((w) => !w.suggested)).toBe(true);
  });
});

describe('every rule fills reasons and evidence', () => {
  const iso = (ms: number) => new Date(NOW - ms).toISOString();
  const order = (p: Partial<OrderRow> & Pick<OrderRow, 'id'>): OrderRow => ({
    order_number: 1, customer_name: 'Deceased', person_name: 'Sam', person_id: 'person', job_id: null,
    value: 2000, permit_cost: 0, deposit_date: null, second_payment_date: null, installation_date: null,
    stone_status: 'NA', inscription_status: 'pending', proof_status: 'Not_Received', invoice_id: null,
    created_at: ago(10), is_test: false, job: { stage: 'confirmed', exit_reason: null, paid_at: null }, ...p,
  });

  it('one item from sales, CS, permits, finance and a shared lane', () => {
    const job: JobRow = {
      id: 'j1', stage: 'enquired', created_at: iso(3_600_000), updated_at: null, paid_at: null, wake_at: null,
      exit_reason: null, person_id: 'p-sales', source: 'email',
      person: { first_name: 'Ada', last_name: 'Lovelace', email: null, is_test: false },
      conversation: {
        id: 'c1', last_inbound_at: iso(3_600_000), last_outbound_at: null, ai_category: null,
        channel: 'email', subject: 'Headstone', last_message_preview: 'Could you price a grey granite headstone?',
      },
    };
    const cs = order({
      id: 'o-cs', order_number: 10, person_id: 'p-cs', person_name: 'Sam', deposit_date: ago(10),
      job: { stage: 'confirmed', exit_reason: null, paid_at: null },
    });
    const permitOrder = order({
      id: 'o-perm', order_number: 11, person_id: 'p-perm', person_name: 'Pat', value: 1500, created_at: ago(80),
      installation_date: new Date(NOW + 10 * 86_400_000).toISOString(),
      job: { stage: 'complete', exit_reason: null, paid_at: null },
    });
    const financeOrder = order({
      id: 'o-fin', order_number: 12, person_id: 'p-fin', person_name: 'Jo', value: 900,
      deposit_date: '2026-09-06', job: { stage: 'complete', exit_reason: null, paid_at: null },
    });
    const permit: PermitRow = {
      id: 'perm1', order_id: 'o-perm', permit_phase: 'with_us', next_action: 'match_form', waiting_on: 'mason',
      sent_at: null, submitted_at: null, returned_at: null, stage_entered_at: iso(5 * 3_600_000),
    };
    const data: BrandData = {
      jobs: [job],
      orders: [cs, permitOrder, financeOrder],
      convs: [{ order_id: 'o-cs', last_inbound_at: iso(2 * 3_600_000), last_outbound_at: null, ai_category: null }],
      permits: [permit],
      orderPayments: [{
        id: 'pay1', order_id: 'o-cs', source: 'stripe', amount: 500, payment_type: 'deposit', status: 'matched',
        received_at: ago(10), external_id: 'pi_1', reference: null,
      }],
      invoices: [],
      invoicePayments: [],
      enquiries: [{ person_id: 'p-sales', channel: 'quote', sub_type: null, created_at: iso(3_600_000), details: { name: 'Grey granite', price: 1800 } }],
    };
    const sales = salesItems(data, NOW);
    const service = csItems(data, NOW);
    const permits = permitItems(data, NOW);
    const finance = financeItems(data, NOW);
    const shared = hubLaneItems([{
      key: 'job:s', personId: 'ps', conversationId: 'cs', name: 'Rita', value: 400, stage: 'Enquired',
      action: { kind: 'follow', label: 'Reply', tone: 'red' }, why: 'Wrote yesterday, waiting on us',
      since: iso(86_400_000), lastInAt: iso(86_400_000), lastOutAt: null,
    }], 'Sales', NOW);
    expect(sales).toHaveLength(1);
    expect(service).toHaveLength(1);
    expect(permits).toHaveLength(1);
    expect(finance).toHaveLength(1);
    expect(shared).toHaveLength(1);

    const ruleItems = [...sales, ...service, ...permits, ...finance];
    for (const item of ruleItems) {
      expect(item.reasons?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(item.evidence?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(item.reasons!.length).toBeLessThanOrEqual(3);
      expect(item.evidence!.length).toBeLessThanOrEqual(3);
      expect(item.short!.length).toBeLessThanOrEqual(28);
      expect(item.short).not.toMatch(/^(reply|call|chase|send|order|fix)\b/i);
      expect(item.factors!.length).toBeGreaterThanOrEqual(2);
      expect(item.factors!.length).toBeLessThanOrEqual(4);
      expect(item.factors!.every((f) => f.length <= 18)).toBe(true);
      expect(item.reasons!.every((w) => !w.suggested)).toBe(true);
      for (const w of item.reasons!) {
        const backed = w.source.kind === 'rule' || item.evidence!.some((e) => e.source.kind === w.source.kind);
        expect(backed).toBe(true);
      }
    }
    const quoted = sales[0].evidence!.find((e) => e.quote);
    expect(quoted?.text).toBe('Could you price a grey granite headstone?');
    expect(quoted?.source.label).toMatch(/^Email · /);
    expect(permits[0].factors).toContain('Blocks fixing');
    expect(finance[0]).toMatchObject({ verb: 'Record payment' });
    const built = buildToday(ruleItems, NOW);
    expect(built.today.Finance[0]).toMatchObject({ kind: 'fix', bucket: 'fix', waitingOn: 'record' });
    expect(shared[0].reasons.length).toBeGreaterThanOrEqual(1);
    expect(shared[0].evidence.length).toBeGreaterThanOrEqual(1);
    expect(shared[0].why).toBe('Wrote yesterday, waiting on us');
  });
});
