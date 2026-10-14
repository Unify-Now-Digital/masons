import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { ageCurve, buildOpportunity, closeWithin, extractQuoteAmount, forecast, todayList } from './opportunities';
import { combineSignals } from './signals';
import { dedupeBareJobs } from './dedupeJobs';
import type { PipelineJob } from '../types/jobsPipeline.types';

const now = new Date('2026-10-14T19:00:00Z');
const iso = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const job = (o: Partial<PipelineJob> = {}): PipelineJob => ({
  id: 'j', organization_id: 'o', person_id: 'p', conversation_id: 'c', enquiry_id: null, source: 'website', stage: 'enquired',
  stage_status: null, paid_at: null, exit_reason: null, exited_at: null, wake_at: null, created_at: iso(10), updated_at: iso(10),
  person: null, conversation: null, enquiry: null, ...o,
});

describe('extractQuoteAmount', () => {
  it('takes the memorial Total, not the guide total or permit', () => {
    expect(extractQuoteAmount('Memorial: £4,050\r\n*Total: £4,050.00*\r\nPermit Fee: £745.00\r\n> Guide total (installed) £5,035')).toBe(4050);
  });
  it('ignores quoted reply text and older quotes below "On … wrote:"', () => {
    expect(extractQuoteAmount('Thanks!\nOn Mon, 1 Sep 2026 at 10:00, SM <info@x> wrote:\nTotal: £3,000')).toBeNull();
    expect(extractQuoteAmount('> Total: £3,000')).toBeNull();
  });
  it('falls back to Total Amount Payable and plain amounts without commas', () => {
    expect(extractQuoteAmount('Total Amount Payable: £2,778.40')).toBe(2778.4);
    expect(extractQuoteAmount('*Total: £1728.00*')).toBe(1728);
    expect(extractQuoteAmount('  - Total Price: £4,128')).toBe(4128);
  });
});

describe('scoring', () => {
  it('age curve falls to zero at 90d', () => {
    expect(ageCurve(0)).toBeCloseTo(0.135, 2);
    expect(ageCurve(60)).toBeCloseTo(0.04, 2);
    expect(ageCurve(95)).toBe(0);
    expect(closeWithin(0, 1000)).toBe(1);
  });
  it('no outbound = red Make first contact; family wrote last = red Reply', () => {
    const a = buildOpportunity({ job: job(), contact: { lastIn: iso(1), lastOut: null }, quote: null }, now);
    expect(a.action).toMatchObject({ label: 'Make first contact', colour: 'red' });
    expect(a.neverContacted).toBe(true);
    const b = buildOpportunity({ job: job(), contact: { lastIn: iso(1), lastOut: iso(4) }, quote: null }, now);
    expect(b.action).toMatchObject({ label: 'Reply', colour: 'red' });
  });
  it('gmail quote wins over the form estimate; quiet quote = amber follow-up; recent = blue wait', () => {
    const q = buildOpportunity({ job: job({ enquiry: { id: 'e', channel: 'quote', price: '5000', permit_fee: null } }), contact: { lastIn: iso(20), lastOut: iso(12) }, quote: { amount: 3200, sentAt: iso(12) } }, now);
    expect(q.value).toBe(3200);
    expect(q.valueSource).toBe('gmail_quote');
    expect(q.action.colour).toBe('amber');
    const w = buildOpportunity({ job: job(), contact: { lastIn: iso(5), lastOut: iso(2) }, quote: { amount: 3200, sentAt: iso(2) } }, now);
    expect(w.action.colour).toBe('blue');
  });
  it('90d+ old with 90d+ no activity goes to abandoned; 60d quiet to revive; cap 15', () => {
    const ab = buildOpportunity({ job: job({ created_at: iso(120) }), contact: { lastIn: iso(100), lastOut: iso(95) }, quote: null }, now);
    expect(ab.bucket).toBe('abandoned');
    const rv = buildOpportunity({ job: job({ created_at: iso(80) }), contact: { lastIn: iso(70), lastOut: iso(65) }, quote: null }, now);
    expect(rv.bucket).toBe('revive');
    const many = Array.from({ length: 30 }, (_, i) => buildOpportunity({ job: job({ id: `j${i}` }), contact: { lastIn: iso(3), lastOut: iso(1) }, quote: null }, now));
    expect(todayList(many)).toHaveLength(15);
  });
});

// Real SM numbers from a read-only export (skipped in CI where the file is absent).
const FIX = '/tmp/pipe.json';
describe.skipIf(!existsSync(FIX))('SM real data (read-only export)', () => {
  it('prints the corrected forecast', () => {
    const d = JSON.parse(readFileSync(FIX, 'utf8'));
    const stages = ['enquired', 'quoted', 'invoiced'];
    const jobs: PipelineJob[] = stages.flatMap((s) => dedupeBareJobs(d.jobs.filter((j: PipelineJob) => j.stage === s)));
    const invs = new Map<string, { count: number; totalAmount: number }>();
    for (const r of d.invoices) if (!r.deleted_at) { const v = invs.get(r.job_id) ?? { count: 0, totalAmount: 0 }; v.count++; v.totalAmount += Number(r.amount); invs.set(r.job_id, v); }
    const sig = combineSignals(jobs, d.convs, d.msgs);
    const real = new Date();
    const opps = jobs.map((j) => buildOpportunity({ job: j, inv: invs.get(j.id), contact: sig.contacts.get(j.id)!, quote: sig.quotes.get(j.id) ?? null }, real));
    const f = forecast(opps, d.closed, real);
    const count = (k: string) => opps.filter((o) => o.valueSource === k).length;
    const t = todayList(opps);
    console.log(JSON.stringify({ n: opps.length, gmail: count('gmail_quote'), fallback: count('fallback'), median: count('median'),
      buckets: { today: opps.filter((o) => o.bucket === 'today').length, revive: opps.filter((o) => o.bucket === 'revive').length, abandoned: opps.filter((o) => o.bucket === 'abandoned').length },
      never: opps.filter((o) => o.neverContacted).length, waiting: opps.filter((o) => o.waitingOnUs).length,
      todayColours: t.map((o) => o.action.colour).join(','), f }, null, 1));
    expect(opps.length).toBeGreaterThan(0);
  });
});

describe('extractQuoteAmount extra phrasings', () => {
  it('reads "formal quote will be" and a bare Memorial line', () => {
    expect(extractQuoteAmount('So the formal quote will be £2,900 including VAT')).toBe(2900);
    expect(extractQuoteAmount('*Memorial £5,520.00*\nhttps://x')).toBe(5520);
  });
});

import { familyWroteRank } from './opportunities';
describe('familyWroteRank (shared Hub/Pipeline/Inbox ranking)', () => {
  it('families waiting on our reply rank above never-contacted deals', () => {
    expect(familyWroteRank({ waitingOnUs: true, neverContacted: false })).toBeLessThan(familyWroteRank({ waitingOnUs: true, neverContacted: true }));
    expect(familyWroteRank({ waitingOnUs: false, neverContacted: true })).toBeLessThan(familyWroteRank({ waitingOnUs: false, neverContacted: false }));
  });
});
