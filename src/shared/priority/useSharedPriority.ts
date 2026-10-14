import { useMemo } from 'react';
import { useOpportunities } from '@/modules/jobsPipeline/hooks/useOpportunities';
import { useCustomerPriority } from './useCustomerPriority';

export interface SharedRank { rank: number; why: string; label: string }

/**
 * Hub / Pipeline / Inbox agree: one ranked list per scope, keyed by person id.
 * Enquiries = jobsPipeline todayList (families waiting on us first, then never
 * contacted, then colour + score; test/staff excluded). Customers = useCustomerPriority.
 */
export function useSharedPriority() {
  const opps = useOpportunities();
  const customers = useCustomerPriority();
  return useMemo(() => {
    const enquiries = new Map<string, SharedRank>();
    opps.today.forEach((o, i) => { const p = o.job.person_id; if (p && !enquiries.has(p)) enquiries.set(p, { rank: i + 1, why: o.action.why, label: o.action.label }); });
    const cust = new Map<string, SharedRank>();
    customers.rows.forEach((r, i) => { if (!cust.has(r.personId)) cust.set(r.personId, { rank: i + 1, why: r.why, label: r.action.label }); });
    return { enquiries, customers: cust, isLoading: opps.isLoading || customers.isLoading };
  }, [opps.today, opps.isLoading, customers.rows, customers.isLoading]);
}

/** Stable re-order: rows in the shared ranking first (by shared rank), the rest keep their order after. */
export function orderByShared<T>(rows: T[], personOf: (r: T) => string | null | undefined, ranks: Map<string, SharedRank>): T[] {
  return rows
    .map((r, i) => ({ r, i, k: ranks.get(personOf(r) ?? '')?.rank ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.r);
}
