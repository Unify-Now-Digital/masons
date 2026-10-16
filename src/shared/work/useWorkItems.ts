/**
 * The single React entry point for the work model (B.3). Composes the existing brand-data
 * query (useBrandData, already org-scoped), runs the adapters, stamps urgency and returns the
 * ranked list. No new queries.
 */
import { useMemo } from 'react';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { useBrandData } from '@/modules/today/useBrandData';
import { workItemsFromBrandData } from './fromBrandData';
import type { Lane, WorkItem } from './types';

export interface UseWorkItemsOptions {
  lanes?: Lane[];
  /** No owner/assignee column exists for any lane yet (docs/work-model-map.md Gaps). 'me' and
   * explicit ids filter on WorkItem.ownerId once adapters can set it; until then every item
   * has ownerId null and 'me' is a no-op (org scoping still applies). */
  ownerId?: string | 'me';
  orderId?: string;
}

export function useWorkItems(opts: UseWorkItemsOptions = {}): { items: WorkItem[]; isLoading: boolean; error: Error | null } {
  const canSeeMoney = useCanSeeMoney(); // same gate as the Hub and Finance
  const q = useBrandData(canSeeMoney);
  const lanesKey = opts.lanes?.join(',') ?? '';
  const items = useMemo(() => {
    if (!q.data) return [];
    const all = workItemsFromBrandData(q.data.data, new Date(), { lanes: opts.lanes, orderId: opts.orderId, canSeeMoney });
    if (!opts.ownerId || opts.ownerId === 'me') return all;
    return all.filter((i) => i.ownerId === opts.ownerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lanes compared by value via lanesKey
  }, [q.data, lanesKey, opts.orderId, opts.ownerId, canSeeMoney]);
  return { items, isLoading: q.isLoading, error: (q.error as Error | null) ?? null };
}
