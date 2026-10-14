import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';

/**
 * Paid-to-date per order (pounds), for the Orders "Paid" bar. Read-only, active org only.
 * Sources: order_payments (pounds, Revolut/bank/cash, status matched) + succeeded
 * invoice_payments (pence) on invoices linked to the order. Money is behind the
 * financials role: staff without it get an empty map (bar hidden).
 */
export function useOrderPaidMap() {
  const { organizationId } = useOrganization();
  const canSeeMoney = useCanSeeMoney();
  return useQuery({
    queryKey: ['orders-paid-map', organizationId],
    enabled: !!organizationId && canSeeMoney,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const [op, inv] = await Promise.all([
        supabase.from('order_payments').select('order_id, amount, status').eq('organization_id', organizationId!).not('order_id', 'is', null),
        supabase.from('invoices').select('id, order_id, invoice_payments(amount, status)').eq('organization_id', organizationId!).is('deleted_at', null).not('order_id', 'is', null),
      ]);
      if (op.error) throw op.error;
      if (inv.error) throw inv.error;
      const m: Record<string, number> = {};
      for (const p of op.data ?? []) {
        if (p.status && !['matched', 'succeeded', 'paid'].includes(p.status)) continue;
        m[p.order_id as string] = (m[p.order_id as string] ?? 0) + Number(p.amount || 0);
      }
      for (const i of (inv.data ?? []) as { order_id: string; invoice_payments: { amount: number; status: string | null }[] | null }[]) {
        for (const p of i.invoice_payments ?? []) {
          if (p.status && p.status !== 'succeeded') continue;
          m[i.order_id] = (m[i.order_id] ?? 0) + Number(p.amount || 0) / 100;
        }
      }
      return m;
    },
  });
}
