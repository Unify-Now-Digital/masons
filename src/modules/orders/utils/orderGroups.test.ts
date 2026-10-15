/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { UIOrder } from './orderTransform';
import {
  cemeteryGroupKey,
  groupBulkLabel,
  groupOrders,
  orderPriorityGroup,
  orderStageGroup,
  readOrdersGroupBy,
  writeOrdersGroupBy,
} from './orderGroups';

const NOW = new Date('2026-10-15T12:00:00Z');

function row(partial: Partial<UIOrder> & Pick<UIOrder, 'id'>): UIOrder {
  return {
    order_number: 1,
    customer: 'Customer',
    deceasedName: 'Deceased',
    type: 'New Memorial',
    stoneStatus: 'Ordered',
    createdAt: '2026-01-01T00:00:00Z',
    permitStatus: 'not_started',
    proofStatus: 'Approved',
    dueDate: '',
    depositDate: '2026-09-01',
    secondPaymentDate: null,
    installationDate: null,
    value: '£1,000',
    total: 1000,
    location: '',
    progress: 0,
    assignedTo: '',
    priority: 'normal',
    sku: '',
    material: '',
    color: '',
    timelineWeeks: 12,
    quoteId: null,
    isTest: false,
    group: 'confirmed',
    jobStage: 'confirmed',
    leadSource: null,
    leadChannel: null,
    jobPaidAt: null,
    jobExitReason: null,
    invoiceLocked: false,
    inscriptionText: 'In loving memory',
    ...partial,
  };
}

describe('order groups', () => {
  beforeEach(() => localStorage.clear());

  it('maps priority from the next-step tone until safe dates exist', () => {
    const overdue = row({ id: 'over', stoneStatus: 'NA', depositDate: '2026-09-01' });
    const week = row({ id: 'week', stoneStatus: 'NA', depositDate: '2026-10-05' });
    const track = row({ id: 'track', stoneStatus: 'NA', depositDate: '2026-10-14' });
    const waiting = row({ id: 'wait', stoneStatus: 'Ordered', depositDate: '2026-06-01', timelineWeeks: 1 });
    expect(orderPriorityGroup(overdue, NOW)).toBe('Overdue');
    expect(orderPriorityGroup(week, NOW)).toBe('Due this week');
    expect(orderPriorityGroup(track, NOW)).toBe('On track');
    expect(orderPriorityGroup(waiting, NOW)).toBe('Waiting on others');
    expect(groupOrders([track, overdue, waiting, week], 'priority', NOW).map((g) => g.key)).toEqual([
      'Overdue',
      'Due this week',
      'On track',
      'Waiting on others',
    ]);
  });

  it('groups by the next step stage, stone before permit and proof, and hides empty groups', () => {
    const stone = row({ id: 's', stoneStatus: 'NA' });
    const proof = row({ id: 'p', stoneStatus: 'Ordered', proofStatus: 'NA', inscriptionText: '' });
    const other = row({ id: 'o', depositDate: '', stoneStatus: 'NA' });
    expect(orderStageGroup(stone, NOW)).toBe('Stone');
    expect(orderStageGroup(proof, NOW)).toBe('Proof');
    expect(orderStageGroup(other, NOW)).toBe('Other');
    expect(groupOrders([proof, other, stone], 'stage', NOW).map((g) => g.key)).toEqual(['Stone', 'Proof', 'Other']);
  });

  it('groups cemeteries alphabetically and drops the supplier option', () => {
    const a = row({ id: 'a', cemeteryName: 'Zeta' });
    const b = row({ id: 'b', location: 'Alpha' });
    const c = row({ id: 'c' });
    expect(cemeteryGroupKey(c)).toBe('No cemetery');
    expect(groupOrders([a, c, b], 'cemetery', NOW).map((g) => g.key)).toEqual(['Alpha', 'No cemetery', 'Zeta']);
  });

  it('labels the overdue stone pill and stays quiet when no permit action exists', () => {
    const stones = [
      row({ id: 'a', stoneStatus: 'NA', depositDate: '2026-09-01' }),
      row({ id: 'b', stoneStatus: 'NA', depositDate: '2026-08-01' }),
    ];
    expect(groupBulkLabel('priority', 'Overdue', stones, NOW)).toBe('Order 2 overdue stones');
    expect(groupBulkLabel('priority', 'Overdue', [stones[0]], NOW)).toBe('Order 1 overdue stone');
    expect(groupBulkLabel('priority', 'On track', stones, NOW)).toBeNull();
    expect(groupBulkLabel('cemetery', 'Alpha', stones, NOW)).toBeNull();
  });

  it('persists the group mode per organisation', () => {
    expect(readOrdersGroupBy('org-1')).toBe('priority');
    writeOrdersGroupBy('org-1', 'stage');
    writeOrdersGroupBy('org-2', 'none');
    expect(readOrdersGroupBy('org-1')).toBe('stage');
    expect(readOrdersGroupBy('org-2')).toBe('none');
    expect(localStorage.getItem('mason-orders-groupby:org-1')).toBe('stage');
  });
});
