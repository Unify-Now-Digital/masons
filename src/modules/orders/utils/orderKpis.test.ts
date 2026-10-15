import { describe, expect, it } from 'vitest';
import { kpiSummary, matchesKpi } from './orderKpis';
import type { UIOrder } from './orderTransform';

function active(partial: Partial<UIOrder> & Pick<UIOrder, 'id'>): UIOrder {
  return {
    order_number: 1,
    customer: 'Customer',
    deceasedName: '',
    type: 'New Memorial',
    stoneStatus: 'Ordered',
    permitStatus: 'not_started',
    proofStatus: 'NA',
    dueDate: '',
    depositDate: '2026-09-01',
    secondPaymentDate: null,
    installationDate: null,
    value: '£500',
    total: 500,
    location: '',
    progress: 0,
    assignedTo: '',
    priority: 'normal',
    sku: '',
    material: '',
    color: '',
    timelineWeeks: 8,
    quoteId: null,
    isTest: false,
    group: 'confirmed',
    jobStage: 'confirmed',
    leadSource: null,
    leadChannel: null,
    jobPaidAt: '2026-09-01',
    jobExitReason: null,
    invoiceLocked: false,
    inscriptionText: '',
    ...partial,
  };
}

describe('order KPIs', () => {
  it('excludes pre-approved permits from Permit blocked', () => {
    const blocked = active({ id: 'blocked', permitStatus: 'pending' });
    const standing = active({ id: 'standing', permitStatus: 'not_started', permitPreapproved: true });
    const approved = active({ id: 'approved', permitStatus: 'approved' });
    expect(matchesKpi(blocked, 'permit')).toBe(true);
    expect(matchesKpi(standing, 'permit')).toBe(false);
    expect(matchesKpi(approved, 'permit')).toBe(false);
    expect(kpiSummary([blocked, standing, approved]).permit.count).toBe(1);
  });

  it('counts proofs that have no inscription', () => {
    const missing = active({ id: 'm', proofStatus: 'Sent', inscriptionText: '  ' });
    const recorded = active({ id: 'r', proofStatus: 'Sent', inscriptionText: 'Beloved' });
    const figures = kpiSummary([missing, recorded]);
    expect(figures.proof.count).toBe(2);
    expect(figures.proof.noInscription).toBe(1);
  });
});
