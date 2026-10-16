import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { isOrderOpen } from '@/modules/inbox/utils/inboxBuckets';
import { isTestPerson } from '@/modules/jobsPipeline/utils/testDeals';
import { customerPriorityItem, customerPriorityList, type Ball, type PriorityItem } from './customerPriority';

/**
 * Customers (post-sale) priority — THE shared source for Hub and Inbox.
 * Open, non-test orders + who wrote last per person (from inbox_conversations
 * last_inbound_at / last_outbound_at). Read-only.
 */
const POST_SALE = new Set(['confirmed', 'in_production', 'fixed', 'complete']);

export function useCustomerPriority(cap?: number) {
  const { organizationId } = useOrganization();
  const orders = useOrdersList();
  const open = useMemo(() => (orders.data ?? [])
    .filter((o) => !o.archived_at && !o.is_test && isOrderOpen(o) && o.person_id && POST_SALE.has(o.job?.stage ?? ''))
    .filter((o) => ![o.person_name, o.customer_name].some((n) => isTestPerson({ first_name: n, email: o.customer_email }))), [orders.data]);
  const personIds = useMemo(() => [...new Set(open.map((o) => o.person_id!))].sort(), [open]);
  const convs = useQuery({
    queryKey: ['priority', 'customerBall', organizationId, personIds.join(',')],
    enabled: !!organizationId && personIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inbox_conversations')
        .select('id, person_id, last_inbound_at, last_outbound_at, last_message_at')
        .eq('organization_id', organizationId!)
        .in('person_id', personIds);
      if (error) throw error;
      return (data ?? []) as { id: string; person_id: string | null; last_inbound_at: string | null; last_outbound_at: string | null; last_message_at: string | null }[];
    },
  });
  return useMemo(() => {
    const now = Date.now();
    const ball = new Map<string, Ball>();
    const ballAt = new Map<string, number>();
    const latestConv = new Map<string, { id: string; at: number }>();
    for (const c of convs.data ?? []) {
      if (!c.person_id) continue;
      const inb = c.last_inbound_at ? Date.parse(c.last_inbound_at) : NaN;
      const out = c.last_outbound_at ? Date.parse(c.last_outbound_at) : NaN;
      const at = Math.max(Number.isNaN(inb) ? 0 : inb, Number.isNaN(out) ? 0 : out);
      let b: Ball | null = null;
      if (!Number.isNaN(inb) && (Number.isNaN(out) || inb >= out)) b = { side: 'us', sinceMs: Math.max(0, now - inb) };
      else if (!Number.isNaN(out)) b = { side: 'them', sinceMs: Math.max(0, now - out) };
      if (b && at >= (ballAt.get(c.person_id) ?? -1)) {
        ball.set(c.person_id, b);
        ballAt.set(c.person_id, at);
      }
      const messageAt = Date.parse(c.last_message_at ?? '') || 0;
      if (!latestConv.has(c.person_id) || messageAt > latestConv.get(c.person_id)!.at) latestConv.set(c.person_id, { id: c.id, at: messageAt });
    }
    const items = open.map((o) => customerPriorityItem(o, ball.get(o.person_id!) ?? null)).filter((x): x is PriorityItem => !!x);
    const rows = customerPriorityList(items, cap).map((it) => ({ ...it, conversationId: latestConv.get(it.personId)?.id ?? null }));
    return { rows, isLoading: orders.isLoading || convs.isLoading };
  }, [open, convs.data, convs.isLoading, orders.isLoading, cap]);
}
