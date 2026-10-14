import { describe, expect, it } from 'vitest';
import { groupOrdersByNextAction, isGroupCollapsedByDefault } from './orderNextAction';
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
        o('b', { jobPaidAt: null }),
        o('c', {}),
        o('d', { jobPaidAt: null, proofStatus: 'Received' }),
      ],
      NOW,
    );
    expect(groups.map((g) => [g.key, g.orders.map((x) => x.id)])).toEqual([
      ['needs_us', ['b', 'd']],
      ['nothing_due', ['a', 'c']],
    ]);
  });
  it('drops empty groups', () => {
    expect(groupOrdersByNextAction([o('c', {})], NOW).map((g) => g.key)).toEqual(['nothing_due']);
  });
});

describe('isGroupCollapsedByDefault', () => {
  it('every group starts expanded', () => {
    expect(isGroupCollapsedByDefault('nothing_due')).toBe(false);
    expect(isGroupCollapsedByDefault('needs_us')).toBe(false);
    expect(isGroupCollapsedByDefault('waiting')).toBe(false);
  });
});

import { nextStepTarget } from './orderNextAction';
describe('nextStepTarget', () => {
  it('maps only to existing screens; waiting/none have no primary', () => {
    expect(nextStepTarget('permit')).toBeNull();
    expect(nextStepTarget('proof')).toBeNull();
    expect(nextStepTarget('balance')?.to).toBe('/dashboard/finance');
    expect(nextStepTarget('waiting')).toBeNull();
    expect(nextStepTarget('none')).toBeNull();
  });
});

describe('nextStepTarget with an invoice', () => {
  it('deposit / balance open the invoice Collect payment pre-filled', () => {
    expect(nextStepTarget('deposit', 'inv-9')?.to).toBe('/dashboard/finance?invoice=inv-9&focus=collect&amount=deposit');
    expect(nextStepTarget('balance', 'inv-9')?.to).toBe('/dashboard/finance?invoice=inv-9&focus=collect&amount=full');
    expect(nextStepTarget('permit', 'inv-9')).toBeNull();
  });
});
