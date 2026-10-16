import { describe, expect, it } from 'vitest';
import { STAGES, TERMINAL, translateOrderPermitStatus, translateOrderProofState, translateOrderProofStatus, translatePermitPhase, translateSalesStage } from './stages';

describe('stages', () => {
  it('sales closes as abandoned, never lost (Decision 2)', () => {
    expect(STAGES.sales).not.toContain('lost' as never);
    expect(TERMINAL.sales).toEqual(['won', 'abandoned']);
    for (const r of ['lost', 'closed', 'dormant', 'cancelled', 'abandoned']) expect(translateSalesStage(null, r)).toBe('abandoned');
    expect(translateSalesStage('enquired', 'on_hold')).toBeNull();
    expect(translateSalesStage('enquired', null)).toBe('enquiry');
    expect(translateSalesStage('complete', null)).toBe('won');
  });
  it('cs is its own lane', () => { expect(STAGES.cs).toContain('family_waiting'); });
  it('translates permit and proof vocabularies, null for gaps', () => {
    expect(translatePermitPhase('with_customer')).toBe('with_family');
    expect(translatePermitPhase('bogus')).toBeNull();
    expect(translateOrderPermitStatus('pending')).toBe('submitted');
    expect(translateOrderPermitStatus('customer_completed')).toBeNull();
    expect(translateOrderProofStatus('Received')).toBeNull();
    expect(translateOrderProofState('failed')).toBeNull();
  });
});
