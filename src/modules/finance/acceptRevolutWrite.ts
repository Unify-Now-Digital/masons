import { supabase } from '@/shared/lib/supabase';
import type { OrderPaymentRow } from '@/modules/today/brandData.types';
import {
  acceptRevolutDecision,
  ignoreRevolutDecision,
  type RevolutDecisionKind,
} from './acceptRevolut';

async function assertOwner(organizationId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Only the owner can accept payments');
  const { data, error } = await supabase
    .from('organization_members')
    .select('is_owner')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || data?.is_owner !== true) throw new Error('Only the owner can accept payments');
}

async function actorEmail(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? 'reconcile';
}

async function reread(id: string, organizationId: string): Promise<OrderPaymentRow | null> {
  const { data, error } = await supabase
    .from('order_payments')
    .select('id, order_id, source, amount, payment_type, status, received_at, external_id, reference')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as OrderPaymentRow | null) ?? null;
}

/**
 * Update the existing unmatched Revolut row. A second accept of the same order is a no-op success.
 * The filter includes external_id so a manual row can never be rewritten into this transaction.
 */
export async function acceptRevolutPayment(args: {
  organizationId: string;
  row: OrderPaymentRow;
  orderId: string;
  paid: number;
}): Promise<RevolutDecisionKind> {
  await assertOwner(args.organizationId);
  const actor = await actorEmail();
  const now = new Date().toISOString();
  const decision = acceptRevolutDecision(args.row, args.orderId, args.paid, actor, now);
  if (decision.kind !== 'update') return decision.kind;
  const { data, error } = await supabase
    .from('order_payments')
    .update(decision.patch)
    .eq('id', args.row.id)
    .eq('organization_id', args.organizationId)
    .eq('external_id', args.row.external_id!)
    .eq('status', 'unmatched')
    .select('id');
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return 'update';
  const again = acceptRevolutDecision(await reread(args.row.id, args.organizationId), args.orderId, args.paid, actor, now);
  return again.kind === 'update' ? 'conflict' : again.kind;
}

export async function ignoreRevolutPayment(args: {
  organizationId: string;
  row: OrderPaymentRow;
}): Promise<RevolutDecisionKind> {
  await assertOwner(args.organizationId);
  const actor = await actorEmail();
  const now = new Date().toISOString();
  const decision = ignoreRevolutDecision(args.row, actor, now);
  if (decision.kind !== 'update') return decision.kind;
  const { data, error } = await supabase
    .from('order_payments')
    .update(decision.patch)
    .eq('id', args.row.id)
    .eq('organization_id', args.organizationId)
    .eq('external_id', args.row.external_id!)
    .eq('status', 'unmatched')
    .select('id');
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return 'update';
  const again = ignoreRevolutDecision(await reread(args.row.id, args.organizationId), actor, now);
  return again.kind === 'update' ? 'conflict' : again.kind;
}
