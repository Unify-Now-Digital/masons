import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { orderPaymentsKeys } from './useOrderPayments';

// Amount tolerance: warn if payment differs from expected by more than this %
const AMOUNT_MISMATCH_THRESHOLD = 0.20; // 20%

interface MatchPaymentParams {
  paymentId: string;
  orderId: string;
  paymentType: 'deposit' | 'final' | 'permit' | 'other';
  matchedBy: string;
  /** Set to true to bypass amount mismatch warning (user confirmed the mismatch) */
  forceMatch?: boolean;
}

interface MarkPassThroughParams {
  paymentId: string;
}

export class AmountMismatchError extends Error {
  paymentAmount: number;
  expectedAmount: number;
  deltaPercent: number;

  constructor(paymentAmount: number, expectedAmount: number, deltaPercent: number) {
    super(
      `Payment amount (£${paymentAmount.toFixed(2)}) differs from expected ` +
      `(£${expectedAmount.toFixed(2)}) by ${Math.round(deltaPercent * 100)}%. ` +
      `Confirm this match is intentional.`
    );
    this.name = 'AmountMismatchError';
    this.paymentAmount = paymentAmount;
    this.expectedAmount = expectedAmount;
    this.deltaPercent = deltaPercent;
  }
}

async function matchPaymentToOrder(
  {
    paymentId,
    orderId,
    paymentType,
    matchedBy,
    forceMatch,
    organizationId,
  }: MatchPaymentParams & { organizationId: string },
) {
  // --- Server-side validation: check amount tolerance ---
  if (!forceMatch) {
    // Fetch payment amount
    const { data: payment, error: payErr } = await supabase
      .from('order_payments')
      .select('amount')
      .eq('id', paymentId)
      .eq('organization_id', organizationId)
      .single();

    if (payErr || !payment) throw new Error('Payment not found');

    // Fetch order expected amounts
    const { data: order, error: ordErr } = await supabase
      .from('orders_with_balance')
      .select('balance_due, total_order_value, value')
      .eq('id', orderId)
      .eq('organization_id', organizationId)
      .single();

    if (ordErr || !order) throw new Error('Order not found');

    const paymentAmount = Number(payment.amount);
    const expectedAmount = Number(order.balance_due ?? order.total_order_value ?? order.value ?? 0);

    if (expectedAmount > 0) {
      const delta = Math.abs(paymentAmount - expectedAmount) / expectedAmount;
      if (delta > AMOUNT_MISMATCH_THRESHOLD) {
        throw new AmountMismatchError(paymentAmount, expectedAmount, delta);
      }
    }
  }

  // --- Perform the match ---
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('order_payments')
    .update({
      order_id: orderId,
      payment_type: paymentType,
      status: 'matched',
      matched_at: now,
      matched_by: matchedBy,
    })
    .eq('id', paymentId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function markAsPassThrough({
  paymentId,
  organizationId,
}: MarkPassThroughParams & { organizationId: string }) {
  const { data, error } = await supabase
    .from('order_payments')
    .update({
      status: 'pass_through',
      payment_type: 'permit',
      matched_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function useMatchPayment() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (params: MatchPaymentParams) => {
      if (!organizationId) throw new Error('No organization selected');
      return matchPaymentToOrder({ ...params, organizationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderPaymentsKeys.all });
    },
  });
}

export function useMarkPassThrough() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (params: MarkPassThroughParams) => {
      if (!organizationId) throw new Error('No organization selected');
      return markAsPassThrough({ ...params, organizationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderPaymentsKeys.all });
    },
  });
}
