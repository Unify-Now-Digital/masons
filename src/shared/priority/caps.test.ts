import { describe, expect, it } from 'vitest';
import { LANE_CAPS } from '@/modules/today/todayModel';
import { LANE_LIST_CAP } from './caps';
import type { PriorityItem } from './customerPriority';
import { customerPriorityRows, enquiryPriorityRows } from './lanes';

describe('lane caps', () => {
  it('uses the purposes caps for Today and for Inbox Priority', () => {
    expect(LANE_LIST_CAP).toEqual({ Sales: 15, CS: 10, Proofs: 10, Permits: 7, Finance: 5 });
    expect(LANE_CAPS).toEqual(LANE_LIST_CAP);
  });

  it('caps the CS list at 10 even when more customers are ranked', () => {
    const items: PriorityItem[] = Array.from({ length: 20 }, (_, n) => ({
      key: `k${n}`, personId: `p${n}`, name: `N${n}`, value: 1, stage: 'In production',
      action: { kind: 'follow', label: 'Reply', tone: 'red', colour: 'red' },
      why: 'waiting', since: null, tier: 6, urgency: n,
    }));
    expect(customerPriorityRows(items)).toHaveLength(LANE_LIST_CAP.CS);
    expect(customerPriorityRows(items)).toHaveLength(10);
    expect(enquiryPriorityRows([], LANE_LIST_CAP.Sales)).toHaveLength(0);
  });
});
