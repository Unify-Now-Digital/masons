import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Package, X } from 'lucide-react';
import { useOrdersByPersonId } from '@/modules/orders/hooks/useOrders';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { getOrderTotalFormatted } from '@/modules/orders/utils/orderCalculations';
import { formatOrderTypeLabel } from '@/modules/orders/utils/orderTypeDisplay';
import { CreateOrderDrawer } from '@/modules/orders/components/CreateOrderDrawer';
import { useConversationsJobs, resolvePersonId } from '@/modules/jobsPipeline';
import { useCustomer, customersKeys } from '@/modules/customers/hooks/useCustomers';
import { useConversation } from '@/modules/inbox/hooks/useInboxConversations';
import { linkConversation } from '@/modules/inbox/api/inboxConversations.api';
import { OrderContextSummary } from '@/modules/inbox/components/OrderContextSummary';
import { InboxOrderListRow } from '@/modules/inbox/components/InboxOrderListRow';
import type { Order } from '@/modules/orders/types/orders.types';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/utils';
import { formatDateDMY } from '@/shared/lib/formatters';

interface PersonOrdersPanelProps {
  personId: string | null;
  /** Conversations behind the current selection — drives the linked-job probe (both views). */
  conversationIds: string[];
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  onCloseOrder: () => void;
  onOrdersCountChange?: (count: number) => void;
}

const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-gardens-txs';

export const PersonOrdersPanel: React.FC<PersonOrdersPanelProps> = ({
  personId,
  conversationIds,
  selectedOrderId,
  onSelectOrder,
  onCloseOrder,
  onOrdersCountChange,
}) => {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: orders = [], isLoading, error } = useOrdersByPersonId(personId);

  // Linked-job probe (same query the conversation views run — cache-shared).
  // Orders created here attach to the most recent ACTIVE job (not exited, not paid).
  const jobsQuery = useConversationsJobs(conversationIds);
  const jobsResolved = jobsQuery.data !== undefined;
  const latestActiveJob = jobsQuery.data?.find((j) => !j.exit_reason && !j.paid_at) ?? null;

  // S5: order creation from a job-linked conversation with no resolvable person first
  // creates/dedupes the person (org-scoped) and links the conversation, like Add-to-pipeline.
  const [resolvedPersonId, setResolvedPersonId] = useState<string | null>(null);
  const [resolvingPerson, setResolvingPerson] = useState(false);
  const effectivePersonId = personId ?? resolvedPersonId;
  const { data: person } = useCustomer(effectivePersonId ?? '');
  const { data: s5Conversation } = useConversation(
    !personId && latestActiveJob ? latestActiveJob.conversation_id : null
  );

  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);

  const conversationsKey = useMemo(() => conversationIds.join(','), [conversationIds]);
  useEffect(() => {
    setResolvedPersonId(null);
  }, [personId, conversationsKey]);

  useEffect(() => {
    // An active job counts as context: keep the panel expanded so the "New order"
    // entry point is visible before the first order exists.
    if (!isLoading) onOrdersCountChange?.(orders.length || (latestActiveJob ? 1 : 0));
  }, [orders.length, isLoading, onOrdersCountChange, latestActiveJob]);

  const handleNewOrder = async () => {
    if (effectivePersonId) {
      setOrderDrawerOpen(true);
      return;
    }
    if (!latestActiveJob || !organizationId) return;
    const handle = s5Conversation?.primary_handle;
    if (!s5Conversation || !handle) {
      toast({
        title: 'No contact handle',
        description: 'This conversation has no contact handle to create a customer from.',
        variant: 'destructive',
      });
      return;
    }
    setResolvingPerson(true);
    try {
      const { personId: newPersonId } = await resolvePersonId(organizationId, handle);
      await linkConversation(s5Conversation.id, newPersonId, organizationId);
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: customersKeys.all });
      setResolvedPersonId(newPersonId);
      setOrderDrawerOpen(true);
    } catch (err) {
      console.error(err);
      // 23505 on the GLOBAL people_email_key unique index: the email exists in another
      // org. Known multi-tenancy limitation pending the (organization_id, lower(email))
      // index migration — not fixable client-side.
      const isCrossOrgEmailConflict =
        typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
      toast({
        title: 'Could not resolve customer',
        description: isCrossOrgEmailConflict
          ? 'A customer with this email already exists in another organization — known limitation pending a database fix'
          : err instanceof Error
            ? err.message
            : 'Failed to create or match a customer for this conversation.',
        variant: 'destructive',
      });
    } finally {
      setResolvingPerson(false);
    }
  };

  const autoSelectedPersonRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !isLoading &&
      orders.length > 0 &&
      personId &&
      autoSelectedPersonRef.current !== personId
    ) {
      autoSelectedPersonRef.current = personId;
      onSelectOrder(orders[0].id);
    }
  }, [isLoading, orders, personId, onSelectOrder]);

  const displayOrder =
    orders.length > 0
      ? selectedOrderId
        ? orders.find((o) => o.id === selectedOrderId) ?? orders[0]
        : orders[0]
      : null;

  // Order-creation affordance: "New order" when an active job is linked (FR-1);
  // otherwise a pointer to Add-to-pipeline (OQ-1). Hidden until the probe resolves.
  const jobAction = !jobsResolved ? null : latestActiveJob ? (
    <button
      type="button"
      onClick={handleNewOrder}
      disabled={resolvingPerson}
      className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg border border-gardens-bdr text-gardens-tx bg-white hover:bg-gardens-page focus:outline-none focus:ring-2 focus:ring-gardens-grn/30 disabled:opacity-50"
    >
      {resolvingPerson ? 'Preparing…' : 'New order'}
    </button>
  ) : (
    <p className="text-[11px] text-gardens-txs">Add to pipeline to create orders</p>
  );

  // S5 exception: a job-linked conversation without a resolvable person still gets
  // the creation entry point (person is created/deduped on click).
  if (!personId && !latestActiveJob) {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <p className="text-center text-gardens-txs text-sm">
            Order context is available when a linked customer is selected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-gardens-page/60">
      {/* ORDER CONTEXT header with optional close */}
      <div className="shrink-0 flex items-center justify-between gap-2 pb-2 px-3 pt-3 border-b border-gardens-bdr">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 shrink-0 text-gardens-txs" />
          <h2 className={cn(SECTION_LABEL, 'normal-case font-semibold text-gardens-tx')}>
            Order context {orders.length > 0 && `(${orders.length})`}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCloseOrder}
          className="p-1 rounded-md text-gardens-txs hover:text-gardens-tx hover:bg-gardens-bdr focus:outline-none"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto scrollbar-hide px-3 py-3 space-y-3">
        {isLoading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-28 w-full rounded-xl bg-gardens-bdr/80" />
            <Skeleton className="h-10 w-full rounded-lg bg-gardens-bdr/80" />
            <Skeleton className="h-10 w-full rounded-lg bg-gardens-bdr/80" />
          </div>
        ) : error ? (
          <div className="text-sm text-gardens-red-dk">
            {error instanceof Error ? error.message : 'Failed to load orders'}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center text-gardens-txs text-sm py-4 space-y-2">
            <p>No orders for this person yet</p>
            {jobAction && <div className="flex justify-center">{jobAction}</div>}
          </div>
        ) : (
          <>
            {displayOrder && (
              <OrderContextSummary order={displayOrder} />
            )}
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between px-0.5 mb-1.5">
                <p className={cn(SECTION_LABEL)}>Orders</p>
                {jobAction}
              </div>
              <div className="space-y-1">
                {orders.map((order) => (
                  <InboxOrderListRow
                    key={order.id}
                    orderId={getOrderDisplayId(order)}
                    description={
                      formatOrderTypeLabel(order.order_type) +
                      (order.due_date ? ` · Due ${formatDateDMY(order.due_date)}` : '')
                    }
                    amount={getOrderTotalFormatted(order)}
                    selected={selectedOrderId === order.id}
                    onClick={() => {
                      onSelectOrder(order.id);
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <CreateOrderDrawer
        open={orderDrawerOpen}
        onOpenChange={setOrderDrawerOpen}
        initialJobId={latestActiveJob?.id ?? null}
        initialPersonId={effectivePersonId}
        initialCustomerEmail={person?.email ?? undefined}
        initialCustomerPhone={person?.phone ?? undefined}
        onOrderCreated={onSelectOrder}
      />
    </div>
  );
};
