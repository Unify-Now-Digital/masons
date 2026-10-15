import { describe, expect, it } from 'vitest';
import { buildDeals, buildRibbons, bySource, NOT_RECORDED, type FlowJob } from './leadFlow';

const job = (id: string, stage: string, lead_source: string | null, paid_at: string | null = null): FlowJob => ({
  id, stage, source: 'website', created_at: '2026-10-01T00:00:00Z', exit_reason: null, paid_at, person_id: id, person_name: id,
  conversation_id: null, last_outbound_at: null, lead_source,
});

describe('finance by lead source', () => {
  it('keys deals by lead_source (job, then enquiry) and never guesses', () => {
    const deals = buildDeals([job('a', 'quoted', 'Google Ads'), job('b', 'enquired', null), job('c', 'enquired', null)],
      [{ person_id: 'b', channel: 'quote', lead_source: 'FD referral', sub_type: null, product: null, price: null, order_id: null, created_at: '2026-10-01' }], []);
    expect(deals.map((d) => d.source)).toEqual(['Google Ads', 'Funeral director', NOT_RECORDED]);
  });
  it('counts leads, quotes, deposits, revenue and cost per deposit', () => {
    const deals = buildDeals([job('a', 'confirmed', 'Google Ads', '2026-10-02'), job('b', 'quoted', 'Google Ads'), job('c', 'invoiced', 'Organic')], [],
      [{ id: 'o1', job_id: 'a', value: 1200, product: null, deposit_date: '2026-10-02', installation_date: null }]);
    const rows = bySource(deals, 600);
    expect(rows[0]).toEqual({ source: 'Google Ads', leads: 2, quotes: 2, deposits: 1, revenue: 1200, spend: 600, costPerDeposit: 600 });
    expect(rows[1]).toMatchObject({ source: 'Organic', leads: 1, quotes: 1, deposits: 0, spend: null });
  });
  it('spend with no Ads deposits gives no cost per deposit', () => {
    expect(bySource([], 100)[0]).toMatchObject({ source: 'Google Ads', spend: 100, costPerDeposit: null });
  });
});

describe('finance by enquiry type', () => {
  const enq = (person_id: string, channel: string | null, lead_channel: string | null = null) =>
    ({ person_id, channel, lead_channel, lead_source: null, sub_type: null, product: null, price: null, order_id: null, created_at: '2026-10-01' });
  it('uses lead_channel (job, then enquiry), then maps enquiries.channel, else Not recorded', () => {
    const jobs = [{ ...job('a', 'quoted', null), lead_channel: 'Web chat' }, job('b', 'enquired', null), job('c', 'enquired', null), job('d', 'enquired', null), job('e', 'enquired', null)];
    const deals = buildDeals(jobs, [enq('a', 'quote', 'RAQ'), enq('b', 'contact', 'Brochure'), enq('c', 'quote'), enq('d', 'shortlist')], []);
    expect(deals.map((d) => d.channel)).toEqual(['Web chat', 'Brochure', 'RAQ', 'Contact form', NOT_RECORDED]);
  });
  it('groups the table and ribbons by type; Ads spend only applies by source', () => {
    const deals = buildDeals([job('a', 'confirmed', 'Google Ads', '2026-10-02'), job('b', 'quoted', null)], [enq('a', 'quote'), enq('b', 'quote')], []);
    expect(bySource(deals, 500, 'channel')).toEqual([{ source: 'RAQ', leads: 2, quotes: 2, deposits: 1, revenue: 0, spend: null, costPerDeposit: null }]);
    expect(buildRibbons(deals, 'channel').every((r) => r.source === 'RAQ')).toBe(true);
  });
});
