import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  emptyRollup,
  rollupForOrder,
  type JobForRollup,
  type LinkForRollup,
  type NormalizedStatus,
  type SupplierRollup,
} from '../../../../supabase/functions/_shared/supplierStatus';

export interface SupplierBoardData {
  loaded: boolean;
  unavailable: boolean;
  jobs: JobForRollup[];
  links: LinkForRollup[];
  byOrder: Map<string, SupplierRollup>;
  syncedAt: string | null;
}

const EMPTY: SupplierBoardData = {
  loaded: false,
  unavailable: false,
  jobs: [],
  links: [],
  byOrder: new Map(),
  syncedAt: null,
};

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || message.includes('schema cache') || message.includes('does not exist');
}

interface JobRow {
  id: string;
  job_code: string | null;
  customer_reference: string | null;
  batch_code: string | null;
  container_code: string | null;
  normalized_status: NormalizedStatus | null;
  delivery_date: string | null;
  delivery_estimate: string | null;
  synced_at: string | null;
  stale: boolean | null;
  supplier_parts: { description: string | null; normalized_status: NormalizedStatus | null }[] | null;
}

interface LinkRow {
  id: string;
  order_id: string;
  job_id: string;
  confidence: LinkForRollup['confidence'];
  rule: string;
  link_status: LinkForRollup['linkStatus'];
}

function mapJob(row: JobRow): JobForRollup {
  return {
    id: row.id,
    jobCode: row.job_code,
    customerReference: row.customer_reference,
    batchCode: row.batch_code,
    containerCode: row.container_code,
    normalizedStatus: row.normalized_status,
    deliveryDate: row.delivery_date,
    deliveryEstimate: row.delivery_estimate,
    syncedAt: row.synced_at,
    stale: row.stale === true,
    parts: (row.supplier_parts ?? []).map((part) => ({
      description: part.description,
      normalizedStatus: part.normalized_status,
    })),
  };
}

export async function fetchSupplierBoard(organizationId: string): Promise<SupplierBoardData> {
  const jobsRes = await supabase
    .from('supplier_jobs')
    .select('id, job_code, customer_reference, batch_code, container_code, normalized_status, delivery_date, delivery_estimate, synced_at, stale, supplier_parts(description, normalized_status)')
    .eq('organization_id', organizationId);
  if (jobsRes.error) {
    if (isMissingRelation(jobsRes.error)) return { ...EMPTY, unavailable: true };
    throw jobsRes.error;
  }
  const linksRes = await supabase
    .from('order_supplier_links')
    .select('id, order_id, job_id, confidence, rule, link_status')
    .eq('organization_id', organizationId);
  if (linksRes.error) {
    if (isMissingRelation(linksRes.error)) return { ...EMPTY, unavailable: true };
    throw linksRes.error;
  }
  const jobs = ((jobsRes.data ?? []) as JobRow[]).map(mapJob);
  const links = ((linksRes.data ?? []) as LinkRow[]).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    jobId: row.job_id,
    confidence: row.confidence,
    rule: row.rule,
    linkStatus: row.link_status,
  }));
  const byOrder = new Map<string, SupplierRollup>();
  for (const link of links) {
    if (!byOrder.has(link.orderId)) byOrder.set(link.orderId, rollupForOrder(link.orderId, links, jobs));
  }
  const synced = jobs.map((job) => job.syncedAt).filter((value): value is string => !!value).sort();
  return {
    loaded: true,
    unavailable: false,
    jobs,
    links,
    byOrder,
    syncedAt: synced.length ? synced[synced.length - 1] : null,
  };
}

export function useSupplierBoard(organizationId: string | null | undefined): SupplierBoardData {
  const { data } = useQuery({
    queryKey: ['supplier-board', organizationId],
    queryFn: () => fetchSupplierBoard(organizationId as string),
    enabled: !!organizationId,
    staleTime: 60_000,
  });
  if (!organizationId) return { ...EMPTY, unavailable: true };
  return data ?? EMPTY;
}

/** Loaded rollup, or the empty "not on the board" rollup once the query has succeeded. */
export function supplierRollupFor(board: SupplierBoardData, orderId: string): SupplierRollup | null {
  if (!board.loaded) return null;
  return board.byOrder.get(orderId) ?? emptyRollup();
}

export function useSupplierLinkDecision() {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ linkId, decision }: { linkId: string; decision: 'confirmed' | 'rejected' }) => {
      if (!organizationId) throw new Error('No organisation');
      const patch = decision === 'confirmed'
        ? { link_status: 'confirmed', confirmed_at: new Date().toISOString() }
        : { link_status: 'rejected' };
      const { error } = await supabase
        .from('order_supplier_links')
        .update(patch)
        .eq('id', linkId)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-board', organizationId] });
    },
  });
}
