import { describe, expect, it } from 'vitest';
import { hubLaneItems } from './sharedLanes';
import { customerPriorityRows, enquiryPriorityRows, SHARED_CAP } from '@/shared/priority/lanes';
import { customerPriorityItem, customerPriorityList } from '@/shared/priority/customerPriority';
import { buildOpportunity, todayList } from '@/modules/jobsPipeline/utils/opportunities';

const now = new Date('2026-10-15T09:00:00Z');
const iso = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

// 20 enquiries: a mix of families waiting on us, never contacted and quiet quotes.
const opps = Array.from({ length: 20 }, (_, n) => buildOpportunity({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  job: { id: `j${n}`, stage: n % 3 ? 'enquired' : 'quoted', created_at: iso(10 + n), person_id: `p${n}`, conversation_id: `c${n}`, person: { first_name: `F${n}`, last_name: 'X' } } as any,
  inv: undefined,
  contact: n % 3 === 0 ? { lastIn: iso(n % 5), lastOut: iso(n % 5 + 2) } : n % 3 === 1 ? { lastIn: iso(1 + (n % 4)), lastOut: null } : { lastIn: iso(8), lastOut: iso(1 + n % 6) },
  quote: null,
}, now));

// 20 open orders across the customer tiers.
const orders = Array.from({ length: 20 }, (_, n) => ({
  id: `o${n}`, person_id: `q${n}`, person_name: `C${n}`, value: 1000 + n,
  installation_date: n % 4 === 0 ? iso(-(n % 6)) : null, deposit_date: n % 4 === 1 ? null : iso(30),
  proof_status: n % 4 === 2 ? 'Revision' : null, due_date: n % 5 === 3 ? iso(2) : null, created_at: iso(40), updated_at: iso(n),
}));

describe('Hub lanes == Inbox Priority (one shared list)', () => {
  it('Sales top N equals Inbox Enquiries top N (membership, order, reason, label)', () => {
    const inbox = enquiryPriorityRows(todayList(opps));
    const hub = hubLaneItems(inbox, 'Sales', now.getTime());
    expect(inbox.length).toBeLessThanOrEqual(SHARED_CAP);
    expect(hub.map((h) => [h.key, h.why, h.verb])).toEqual(inbox.map((r) => [r.key, r.why, r.action.label]));
  });
  it('CS top N equals Inbox Customers top N', () => {
    const inbox = customerPriorityRows(customerPriorityList(orders.map((o) => customerPriorityItem(o, null, now)!).filter(Boolean)));
    const hub = hubLaneItems(inbox, 'CS', now.getTime());
    expect(inbox.length).toBe(SHARED_CAP);
    expect(hub.map((h) => [h.key, h.why, h.verb])).toEqual(inbox.map((r) => [r.key, r.why, r.action.label]));
  });
  it('a family who wrote last ranks above a never-contacted deal', () => {
    const rows = enquiryPriorityRows(todayList(opps));
    const firstNever = rows.findIndex((r) => r.action.label === 'Make first contact');
    const lastWrote = rows.map((r) => /waiting on us/.test(r.why)).lastIndexOf(true);
    if (firstNever >= 0 && lastWrote >= 0) expect(lastWrote).toBeLessThan(firstNever);
  });
});
