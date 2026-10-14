import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { fetchAllPages } from '@/shared/lib/fetchAllPages';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { BrandData } from './brandData.types';
import { isTestPerson } from '@/modules/jobsPipeline/utils/testDeals';

/**
 * One brand's rows for Today + Finance. Every query is scoped to the ACTIVE organisation
 * (CM and SM walled). Errors are thrown (never swallowed into an empty list) so the page can
 * say "couldn't load" instead of showing a misleading 0. Read-only.
 */
type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

function all<T>(table: string, select: string, orgId: string, extra?: (q: any) => any, orderCol = 'created_at'): Promise<T[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  return fetchAllPages<T>((from, to) => {
    let q = supabase.from(table).select(select).eq('organization_id', orgId);
    if (extra) q = extra(q);
    return q.order(orderCol, { ascending: false }).order('id').range(from, to) as unknown as Page<T>;
  }).catch((e: unknown) => {
    const msg = (e as { message?: string })?.message ?? String(e);
    throw new Error(`${table}: ${msg}`);
  });
}

export async function fetchBrandData(orgId: string, canSeeMoney: boolean): Promise<{ data: BrandData; moneyError: string | null }> {
  const [jobs, orders, convs, permits] = await Promise.all([
    all<BrandData['jobs'][number]>('jobs',
      'id, stage, created_at, updated_at, paid_at, wake_at, exit_reason, person_id, person:people!jobs_person_id_fkey(first_name, last_name, email, is_test), conversation:inbox_conversations!jobs_conversation_id_fkey(id, last_inbound_at, last_outbound_at, ai_category, channel, subject, last_message_preview)',
      orgId, (q) => q.is('exit_reason', null)),
    all<BrandData['orders'][number]>('orders',
      'id, order_number, customer_name, person_name, person_id, job_id, value, permit_cost, deposit_date, second_payment_date, installation_date, stone_status, inscription_status, proof_status, invoice_id, created_at, is_test, job:jobs!job_id(stage, exit_reason, paid_at)',
      orgId, (q) => q.eq('is_test', false)),
    all<BrandData['convs'][number]>('inbox_conversations', 'id, order_id, last_inbound_at, last_outbound_at, ai_category', orgId, (q) => q.not('order_id', 'is', null)),
    all<BrandData['permits'][number]>('order_permits', 'id, order_id, permit_phase, next_action, waiting_on, sent_at, submitted_at, returned_at, stage_entered_at', orgId),
  ]);
  let orderPayments: BrandData['orderPayments'] = [];
  let invoices: BrandData['invoices'] = [];
  let invoicePayments: BrandData['invoicePayments'] = [];
  let moneyError: string | null = null;
  if (canSeeMoney) {
    try {
      [orderPayments, invoices, invoicePayments] = await Promise.all([
        all<BrandData['orderPayments'][number]>('order_payments', 'id, order_id, source, amount, payment_type, status, received_at, external_id, reference', orgId),
        all<BrandData['invoices'][number]>('invoices',
          'id, order_id, invoice_number, customer_name, amount, status, issue_date, due_date, stripe_invoice_status, stripe_invoice_id, stripe_payment_intent_id, is_test, paid_at, created_at',
          orgId, (q) => q.is('deleted_at', null).eq('is_test', false)),
        all<BrandData['invoicePayments'][number]>('invoice_payments', 'id, invoice_id, amount, status, stripe_payment_intent_id, stripe_charge_id, created_at, received_at, source', orgId),
      ]);
    } catch (e) {
      moneyError = (e as Error).message;
    }
  }
  // Test / staff deals (e.g. 'Eng Grok CF Test') never reach Hub lists: same rule as Pipeline.
  const realJobs = jobs.filter((j) => !isTestPerson(j.person));
  return { data: { jobs: realJobs, orders, convs, permits, orderPayments, invoices, invoicePayments }, moneyError };
}

export const brandKey = (orgId: string | null | undefined) => ['brand-data', orgId] as const;

export function useBrandData(canSeeMoney: boolean) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: [...brandKey(organizationId), canSeeMoney],
    queryFn: () => fetchBrandData(organizationId!, canSeeMoney),
    enabled: !!organizationId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000,
  });
}

export interface RecordPaymentInput {
  orderId: string;
  amount: number;
  receivedAt: string; // YYYY-MM-DD
  source: 'revolut' | 'bank' | 'cash';
  paymentType: 'deposit' | 'final';
  reference: string;
}

/**
 * Record a Revolut / bank payment against an order. Same row shape the revolut-webhook
 * edge function writes (matched order_payments row), with a unique manual external_id.
 * Needs the INSERT policy in migration 20261014200000 (NOT applied yet) — until then
 * Postgres rejects it and the dialog shows that error.
 */
export function useRecordPayment() {
  const { organizationId } = useOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: RecordPaymentInput) => {
      if (!organizationId) throw new Error('No organisation selected');
      if (!(p.amount > 0)) throw new Error('Amount must be more than £0');
      const { data: auth } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const { error } = await supabase.from('order_payments').insert({
        organization_id: organizationId,
        order_id: p.orderId,
        user_id: auth.user?.id ?? null,
        source: p.source,
        external_id: `manual:${crypto.randomUUID()}`,
        amount: Math.round(p.amount * 100) / 100,
        currency: 'GBP',
        payment_type: p.paymentType,
        reference: p.reference || null,
        match_reason: 'manual entry (Finance · Record payment)',
        matched_at: now,
        matched_by: auth.user?.email ?? 'manual',
        status: 'matched',
        received_at: new Date(`${p.receivedAt}T12:00:00`).toISOString(),
      });
      if (error) throw new Error(error.message);
      // Back-compat until deposit_date / second_payment_date are retired.
      const col = p.paymentType === 'deposit' ? 'deposit_date' : 'second_payment_date';
      const { error: oErr } = await supabase.from('orders').update({ [col]: p.receivedAt }).eq('id', p.orderId).eq('organization_id', organizationId).is(col, null);
      if (oErr) throw new Error(`Payment saved, but the order date was not updated: ${oErr.message}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-data'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
