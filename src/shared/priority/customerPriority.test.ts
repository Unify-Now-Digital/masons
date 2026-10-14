import { describe, it, expect } from 'vitest';
import { customerPriorityItem, customerPriorityList } from './customerPriority';

const now = new Date('2026-10-14T12:00:00Z');
const base = { person_id: 'p', deposit_date: '2026-09-01', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };

describe('customer priority', () => {
  it('ranks deadline > chased > money > blocked > waiting > hold', () => {
    const items = [
      customerPriorityItem({ ...base, id: 'h', person_id: 'h', notes: 'ON HOLD till Jan' }, null, now)!,
      customerPriorityItem({ ...base, id: 'w', person_id: 'w' }, null, now)!,
      customerPriorityItem({ ...base, id: 'p', person_id: 'pp', permit_status: 'customer_completed' }, null, now)!,
      customerPriorityItem({ ...base, id: 'm', person_id: 'm', deposit_date: null }, null, now)!,
      customerPriorityItem({ ...base, id: 'c', person_id: 'c' }, { side: 'us', sinceMs: 4 * 86_400_000 }, now)!,
      customerPriorityItem({ ...base, id: 'f', person_id: 'f', installation_date: '2026-10-16T09:00:00Z' }, null, now)!,
    ];
    expect(customerPriorityList(items).map((i) => i.personId)).toEqual(['f', 'c', 'm', 'pp', 'w', 'h']);
    expect(items[5].action).toMatchObject({ label: 'Call', colour: 'red' });
    expect(items[0].action.colour).toBe('blue');
  });
  it('balance due after fixing is amber Request balance', () => {
    const row = customerPriorityItem({ ...base, id: 'b', installation_date: '2026-10-01T00:00:00Z', value: 3000 }, null, now)!;
    expect(row.action).toMatchObject({ label: 'Request balance', colour: 'amber' });
  });
});
