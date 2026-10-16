import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
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

const ORDER_PAYMENT_WIDE = 'id, order_id, source, amount, payment_type, status, received_at, external_id, reference, counterparty_name, provider_state, match_candidates, match_reason';
const ORDER_PAYMENT_NARROW = 'id, order_id, source, amount, payment_type, status, received_at, external_id, reference';

/** Wide select first. Before the Revolut migration the extra columns are absent, so fall back. */
async function fetchOrderPayments(orgId: string): Promise<BrandData['orderPayments']> {
  try {
    return await all<BrandData['orderPayments'][number]>('order_payments', ORDER_PAYMENT_WIDE, orgId);
  } catch (error) {
    const message = (error as Error).message ?? '';
    if (/counterparty_name|provider_state|match_candidates|match_reason|column/i.test(message)) {
      return all<BrandData['orderPayments'][number]>('order_payments', ORDER_PAYMENT_NARROW, orgId);
    }
    throw error;
  }
}

export async function fetchBrandData(orgId: string, canSeeMoney: boolean): Promise<{ data: BrandData; moneyError: string | null }> {
  const [jobs, orders, convs, permits, enquiries] = await Promise.all([
    all<BrandData['jobs'][number]>('jobs',
      'id, stage, source, created_at, updated_at, paid_at, wake_at, exit_reason, person_id, person:people!jobs_person_id_fkey(first_name, last_name, email, is_test), conversation:inbox_conversations!jobs_conversation_id_fkey(id, last_inbound_at, last_outbound_at, ai_category, channel, subject, last_message_preview)',
      orgId, (q) => q.is('exit_reason', null)),
    all<BrandData['orders'][number]>('orders',
      'id, order_number, customer_name, person_name, person_id, customer_email, customer_phone, job_id, deposit_date, second_payment_date, installation_date, stone_status, inscription_status, inscription_text, proof_status, material, color, sku, custom_product_name, invoice_id, created_at, is_test, job:jobs!job_id(stage, exit_reason, paid_at)',
      orgId, (q) => q.eq('is_test', false)),
    all<BrandData['convs'][number]>('inbox_conversations', 'id, order_id, last_inbound_at, last_outbound_at, ai_category', orgId, (q) => q.not('order_id', 'is', null)),
    all<BrandData['permits'][number]>('order_permits', 'id, order_id, permit_phase, next_action, waiting_on, sent_at, submitted_at, returned_at, stage_entered_at', orgId),
    // r2: what they asked for (web quote form product / price) + lead source, per person.
    all<NonNullable<BrandData['enquiries']>[number]>('enquiries', 'id, person_id, channel, sub_type, created_at', orgId).catch(() => []),
  ]);
  const orderIds = orders.map((order) => order.id);
  const enquiryIds = enquiries.map((enquiry) => enquiry.id).filter(Boolean) as string[];
  const [amountRows, statusRows, detailRows] = await Promise.all([
    canSeeMoney && orderIds.length
      ? supabase.from('order_amounts').select('id, value, permit_cost').in('id', orderIds.slice(0, 500)).then((res) => res.data ?? [])
      : Promise.resolve([]),
    orderIds.length
      ? supabase.from('order_payment_status').select('id, deposit_received, fully_paid, balance_outstanding').in('id', orderIds.slice(0, 500)).then((res) => res.data ?? [])
      : Promise.resolve([]),
    enquiryIds.length
      ? supabase.from('enquiry_details_safe').select('id, details').in('id', enquiryIds.slice(0, 500)).then((res) => res.data ?? [])
      : Promise.resolve([]),
  ]);
  const amountById = new Map(amountRows.map((row) => [String((row as { id: string }).id), row as { value?: number | null; permit_cost?: number | null }]));
  const statusById = new Map(statusRows.map((row) => [String((row as { id: string }).id), row as NonNullable<BrandData['orders'][number]['paymentStatus']>]));
  type EnquiryDetails = NonNullable<BrandData['enquiries']>[number]['details'];
  const detailById = new Map<string, EnquiryDetails>();
  for (const row of detailRows) {
    const parsed = row as { id?: string; details?: EnquiryDetails };
    if (parsed.id) detailById.set(String(parsed.id), parsed.details ?? null);
  }
  for (const order of orders) {
    const amount = amountById.get(order.id);
    if (amount) {
      order.value = amount.value ?? null;
      order.permit_cost = amount.permit_cost ?? null;
    }
    order.paymentStatus = statusById.get(order.id) ?? null;
  }
  for (const enquiry of enquiries) {
    if (enquiry.id) enquiry.details = (detailById.get(enquiry.id) as typeof enquiry.details) ?? null;
  }
  let orderPayments: BrandData['orderPayments'] = [];
  let invoices: BrandData['invoices'] = [];
  let invoicePayments: BrandData['invoicePayments'] = [];
  let moneyError: string | null = null;
  if (canSeeMoney) {
    try {
      [orderPayments, invoices, invoicePayments] = await Promise.all([
        fetchOrderPayments(orgId),
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
  return { data: { enquiries, jobs: realJobs, orders, convs, permits, orderPayments, invoices, invoicePayments }, moneyError };
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

/** RPC arguments for public.record_manual_payment (migration 20261015170100). Pure, for tests. */
export function toRecordPaymentRpcArgs(p: RecordPaymentInput) {
  if (!(p.amount > 0)) throw new Error('Amount must be more than £0');
  return {
    p_order_id: p.orderId,
    p_amount: Math.round(p.amount * 100) / 100,
    p_received_at: p.receivedAt,
    p_source: p.source,
    p_payment_type: p.paymentType,
    p_reference: p.reference.trim() || null,
  };
}

/**
 * Record a Revolut / bank / cash payment against an order. One server-side call
 * (public.record_manual_payment, SECURITY DEFINER) inserts the matched order_payments row AND fills
 * deposit_date / second_payment_date, and refuses anyone without a finance role
 * (user_can_view_org_finance: admin + member). Needs migration 20261015170100
 * (NOT applied yet) — until then Postgres rejects the call and the dialog shows that error.
 */
export function useRecordPayment() {
  const { organizationId } = useOrganization();
  const canSeeMoney = useCanSeeMoney();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: RecordPaymentInput) => {
      if (!organizationId) throw new Error('No organisation selected');
      if (!canSeeMoney) throw new Error('Only the owner can record payments');
      const args = toRecordPaymentRpcArgs(p);
      // Function isn't in the generated types until the migration is applied and types are regenerated.
      const rpc = supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      const { error } = await rpc('record_manual_payment', args);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-data'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
