// Creates the Mason `invoices` row for a Stripe invoice that was made OUTSIDE Mason
// (e.g. directly in the Stripe dashboard), then links it to an order/person/job.
// Mason-originated invoices (metadata.mason_invoice_id / invoice_id / organization_id) are
// never created here — their row is written by stripe-create-invoice et al.
// Requires migration 20261015150000_invoices_stripe_link_status.sql.
import type { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import type Stripe from 'npm:stripe@14.21.0';
import {
  masonStatusFromStripe,
  matchStripeInvoice,
  type MatchLookups,
  type OrderRef,
} from '../_shared/stripeInvoiceMatch.ts';

type SupabaseClient = ReturnType<typeof createClient>;

export type EnsureResult =
  | { action: 'exists' }
  | { action: 'skipped'; reason: string }
  | { action: 'created'; invoiceId: string; linkStatus: 'auto' | 'unmatched'; reason: string };

export function buildLookups(supabase: SupabaseClient, organizationId: string): MatchLookups {
  return {
    invoiceExists: async (id) => {
      const { data } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', id)
        .eq('organization_id', organizationId)
        .maybeSingle();
      return !!data;
    },
    orderByNumber: async (n) => {
      const { data } = await supabase
        .from('orders')
        .select('id, person_id, job_id, customer_name')
        .eq('organization_id', organizationId)
        .eq('order_number', n)
        .maybeSingle();
      return (data as OrderRef | null) ?? null;
    },
    openOrdersByEmail: async (email) => {
      const { data: people } = await supabase
        .from('people')
        .select('id')
        .eq('organization_id', organizationId)
        .ilike('email', email);
      const personIds = (people ?? []).map((p: { id: string }) => p.id);
      const { data: byPerson } = personIds.length
        ? await supabase
            .from('orders')
            .select('id, person_id, job_id, customer_name')
            .eq('organization_id', organizationId)
            .is('archived_at', null)
            .in('person_id', personIds)
        : { data: [] };
      const { data: byEmail } = await supabase
        .from('orders')
        .select('id, person_id, job_id, customer_name')
        .eq('organization_id', organizationId)
        .is('archived_at', null)
        .ilike('customer_email', email);
      const seen = new Map<string, OrderRef>();
      for (const o of [...(byPerson ?? []), ...(byEmail ?? [])] as OrderRef[]) seen.set(o.id, o);
      return [...seen.values()];
    },
  };
}

function isMasonOriginated(inv: Stripe.Invoice): boolean {
  const md = inv.metadata ?? {};
  return Boolean(md.mason_invoice_id || md.invoice_id || md.organization_id);
}

export async function ensureMasonInvoiceForStripe(
  supabase: SupabaseClient,
  organizationId: string,
  inv: Stripe.Invoice,
  livemode: boolean,
): Promise<EnsureResult> {
  if (!inv.id) return { action: 'skipped', reason: 'no id' };
  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('stripe_invoice_id', inv.id)
    .maybeSingle();
  if (existing) return { action: 'exists' };
  if (isMasonOriginated(inv)) return { action: 'skipped', reason: 'mason-originated' };
  if (inv.status === 'draft') return { action: 'skipped', reason: 'draft (wait for finalize)' };
  if (inv.currency && inv.currency.toLowerCase() !== 'gbp') return { action: 'skipped', reason: 'non-gbp' };

  const match = await matchStripeInvoice(inv, buildLookups(supabase, organizationId));
  const order = match.kind === 'order' ? match.order : null;

  const created = new Date((inv.created ?? Date.now() / 1000) * 1000);
  const due = inv.due_date ? new Date(inv.due_date * 1000) : created;
  const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null;
  const total = inv.total ?? inv.amount_due ?? 0;

  const row = {
    organization_id: organizationId,
    order_id: order?.id ?? null,
    person_id: order?.person_id ?? null,
    job_id: order?.job_id ?? null,
    invoice_number: inv.number ?? `STRIPE-${inv.id}`,
    customer_name: inv.customer_name || inv.customer_email || 'Unknown (Stripe)',
    amount: total / 100,
    // Payment is recorded by the invoice.paid handler (invoice_payments + amount_paid),
    // so the row starts unpaid even when the first event we see is invoice.paid.
    status: masonStatusFromStripe(inv) === 'paid' ? 'pending' : masonStatusFromStripe(inv),
    due_date: due.toISOString().slice(0, 10),
    issue_date: created.toISOString().slice(0, 10),
    payment_method: 'Credit Card',
    stripe_status: 'unpaid',
    stripe_invoice_id: inv.id,
    stripe_invoice_status: inv.status === 'paid' ? 'open' : inv.status ?? 'open',
    hosted_invoice_url: inv.hosted_invoice_url ?? null,
    amount_paid: 0,
    amount_remaining: total,
    is_test: !livemode,
    stripe_credential_mode: livemode ? 'live' : 'test',
    currency: 'gbp',
    stripe_customer_id: customerId,
    stripe_link_status: order ? 'auto' : 'unmatched',
    stripe_link_reason: match.reason,
    notes: 'Created in Stripe (outside Mason); imported by stripe-webhook',
  };

  const { data, error } = await supabase.from('invoices').insert(row).select('id').single();
  if (error) {
    // 23505 = another delivery won the race (unique stripe_invoice_id / invoice_number).
    if (error.code === '23505') return { action: 'exists' };
    console.error('ensureMasonInvoiceForStripe insert failed', inv.id, error);
    return { action: 'skipped', reason: `insert error ${error.code ?? ''}` };
  }
  console.log('stripe-webhook: imported Stripe-created invoice', inv.id, match.reason);
  return {
    action: 'created',
    invoiceId: (data as { id: string }).id,
    linkStatus: order ? 'auto' : 'unmatched',
    reason: match.reason,
  };
}
