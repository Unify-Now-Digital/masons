import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';

export interface OrderPanelPayment {
  id: string;
  amount: number | string | null;
  status: string;
  received_at: string | null;
  source?: string | null;
  reference?: string | null;
  counterparty_name?: string | null;
  external_id?: string | null;
  provider_state?: string | null;
}

const PANEL_WIDE = 'id, amount, status, received_at, source, reference, counterparty_name, external_id, provider_state';
const PANEL_NARROW = 'id, amount, status, received_at';

/** Read-only: one order's payment rows (order_payments.amount is POUNDS). */
export function useOrderPaymentsByOrder(orderId: string | null | undefined) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: ['order-payments', 'byOrder', organizationId, orderId],
    enabled: !!orderId && !!organizationId,
    queryFn: async () => {
      const wide = await supabase
        .from('order_payments')
        .select(PANEL_WIDE)
        .eq('organization_id', organizationId!)
        .eq('order_id', orderId!);
      if (!wide.error) return (wide.data ?? []) as OrderPanelPayment[];
      if (!/column|counterparty_name|provider_state|external_id|reference/i.test(wide.error.message)) throw wide.error;
      const narrow = await supabase
        .from('order_payments')
        .select(PANEL_NARROW)
        .eq('organization_id', organizationId!)
        .eq('order_id', orderId!);
      if (narrow.error) throw narrow.error;
      return (narrow.data ?? []) as OrderPanelPayment[];
    },
  });
}
