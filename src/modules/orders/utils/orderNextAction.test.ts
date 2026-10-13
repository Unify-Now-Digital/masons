import { describe, expect, it } from 'vitest';
import { groupOrdersByNextAction } from './orderNextAction';
import type { UIOrder } from './orderTransform';

const NOW = new Date('2026-10-14T10:00:00Z');
const o = (id: string, p: Partial<UIOrder>): UIOrder =>
  ({
    id, jobStage: 'confirmed', jobExitReason: null, jobPaidAt: '2026-10-10', depositDate: '',
    secondPaymentDate: null, stoneStatus: 'Ordered', permitStatus: 'approved', proofStatus: 'Approved',
    installationDate: null, ...p,
  }) as unknown as UIOrder;

describe('groupOrdersByNextAction', () => {
  it('splits Needs us / Waiting on others / Nothing due and keeps order', () => {
    const groups = groupOrdersByNextAction(
      [
        o('a', { permitStatus: 'pending' }),
        o('b', { permitStatus: 'not_started' }),
        o('c', {}),
        o('d', { proofStatus: 'Received' }),
      ],
      NOW,
    );
    expect(groups.map((g) => [g.key, g.orders.map((x) => x.id)])).toEqual([
      ['needs_us', ['b', 'd']],
      ['waiting', ['a']],
      ['nothing_due', ['c']],
    ]);
  });
  it('drops empty groups', () => {
    expect(groupOrdersByNextAction([o('c', {})], NOW).map((g) => g.key)).toEqual(['nothing_due']);
  });
});
