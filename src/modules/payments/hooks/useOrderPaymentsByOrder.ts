import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';

/** Read-only: one order's payment rows (order_payments.amount is POUNDS). */
export function useOrderPaymentsByOrder(orderId: string | null | undefined) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: ['order-payments', 'byOrder', organizationId, orderId],
    enabled: !!orderId && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_payments')
        .select('id, amount, status, received_at')
        .eq('organization_id', organizationId!)
        .eq('order_id', orderId!);
      if (error) throw error;
      return (data ?? []) as { id: string; amount: number | string | null; status: string; received_at: string | null }[];
    },
  });
}
