import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { orderPaymentsKeys } from './useOrderPayments';

interface MatchPaymentParams {
  paymentId: string;
  orderId: string;
  paymentType: 'deposit' | 'final' | 'permit' | 'other';
  matchedBy: string;
}

interface MarkPassThroughParams {
  paymentId: string;
}

async function matchPaymentToOrder({ paymentId, orderId, paymentType, matchedBy }: MatchPaymentParams) {
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
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function markAsPassThrough({ paymentId }: MarkPassThroughParams) {
  const { data, error } = await supabase
    .from('order_payments')
    .update({
      status: 'pass_through',
      payment_type: 'permit',
      matched_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function useMatchPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: matchPaymentToOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderPaymentsKeys.all });
    },
  });
}

export function useMarkPassThrough() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAsPassThrough,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderPaymentsKeys.all });
    },
  });
}
