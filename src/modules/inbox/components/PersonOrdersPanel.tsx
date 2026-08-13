import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Package, X } from 'lucide-react';
import { useOrdersByJobId, useOrdersByPersonId } from '@/modules/orders/hooks/useOrders';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { getOrderTotalFormatted } from '@/modules/orders/utils/orderCalculations';
import { formatOrderTypeLabel } from '@/modules/orders/utils/orderTypeDisplay';
import { CreateOrderDrawer } from '@/modules/orders/components/CreateOrderDrawer';
import { CreateInvoiceDrawer } from '@/modules/invoicing';
import { useConversationsJobs, resolvePersonId } from '@/modules/jobsPipeline';
import { effectiveJobId } from '@/modules/inbox/utils/jobPickerLabels';
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
  /** Multi-job picker selection (FR-2/FR-4): null = default rule (newest active job). */
  selectedJobId: string | null;
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  onCloseOrder: () => void;
  onOrdersCountChange?: (count: number) => void;
}

const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-gardens-txs';

export const PersonOrdersPanel: React.FC<PersonOrdersPanelProps> = ({
  personId,
  conversationIds,
  selectedJobId,
  selectedOrderId,
  onSelectOrder,
  onCloseOrder,
  onOrdersCountChange,
}) => {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: orders = [], isLoading, error } = useOrdersByPersonId(personId);
  // FR-7 (amended): person-scoped orphans (job_id = null) never silently vanish
  // from the sidebar — rendered display-only in the Unassigned subsection.
  const unassignedOrders = useMemo(() => orders.filter((o) => o.job_id === null), [orders]);

  // Linked-job probe (same query the conversation views run — cache-shared).
  // Orders created here attach to the SELECTED active job (D7).
  const jobsQuery = useConversationsJobs(conversationIds);
  const jobsResolved = jobsQuery.data !== undefined;
  // FR-2/FR-4: the job that scopes this panel — same shared rule and same
  // cache-shared query as the header picker.
  const effectiveSelectedJobId = effectiveJobId(jobsQuery.data, selectedJobId);
  const effectiveJob = jobsQuery.data?.find((j) => j.id === effectiveSelectedJobId) ?? null;
  // D7: creation targets only an ACTIVE selected job — exited selections are
  // display-only (US-4).
  const activeSelectedJob = effectiveJob && !effectiveJob.exit_reason ? effectiveJob : null;

  // S5: order creation from a job-linked conversation with no resolvable person first
  // creates/dedupes the person (org-scoped) and links the conversation, like Add-to-pipeline.
  const [resolvedPersonId, setResolvedPersonId] = useState<string | null>(null);
  const [resolvingPerson, setResolvingPerson] = useState(false);
  const effectivePersonId = personId ?? resolvedPersonId;
  const { data: person } = useCustomer(effectivePersonId ?? '');
  const { data: s5Conversation } = useConversation(
    !personId && activeSelectedJob ? activeSelectedJob.conversation_id : null
  );

  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = useState(false);

  // "Create invoice" covers the selected job's not-yet-invoiced orders (FR-4);
  // already-invoiced orders are never re-invoiced.
  const { data: jobOrders = [] } = useOrdersByJobId(effectiveJob?.id ?? null);
  const uninvoicedJobOrders = useMemo(
    () => jobOrders.filter((order) => !order.invoice_id),
    [jobOrders]
  );

  const conversationsKey = useMemo(() => conversationIds.join(','), [conversationIds]);
  useEffect(() => {
    setResolvedPersonId(null);
  }, [personId, conversationsKey]);

  useEffect(() => {
    // A selectable job counts as context: keep the panel expanded so the "New
    // order" entry point is visible before the first order exists. Count follows
    // the displayed set (job-scoped + unassigned orphans, FR-7).
    if (!isLoading)
      onOrdersCountChange?.(
        jobOrders.length + unassignedOrders.length || (effectiveJob ? 1 : 0),
      );
  }, [jobOrders.length, unassignedOrders.length, isLoading, onOrdersCountChange, effectiveJob]);

  const handleNewOrder = async () => {
    if (effectivePersonId) {
      setOrderDrawerOpen(true);
      return;
    }
    if (!activeSelectedJob || !organizationId) return;
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
      // 23505 on the org-scoped people_org_email_key unique index
      // ((organization_id, lower(email)), migration 20260802220000): the email
      // already exists in THIS org — e.g. a concurrent create raced the lookup.
      const isDuplicateEmailConflict =
        typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
      toast({
        title: 'Could not resolve customer',
        description: isDuplicateEmailConflict
          ? 'A customer with this email already exists in this organization.'
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
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [summaryFlash, setSummaryFlash] = useState(false);

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

  const displayOrder = selectedOrderId
    ? [...jobOrders, ...unassignedOrders].find((o) => o.id === selectedOrderId) ??
      jobOrders[0] ??
      null
    : jobOrders[0] ?? null;

  // FR-7 (amended): orphans render below the job-scoped list in every selection
  // state — selectable for viewing, no create actions attach to them.
  const unassignedSection = unassignedOrders.length > 0 ? (
    <div className="space-y-1 pt-0.5">
      <p className={cn(SECTION_LABEL, 'px-0.5 mb-1.5')}>Unassigned</p>
      <div className="space-y-1">
        {unassignedOrders.map((order) => (
          <InboxOrderListRow
            key={order.id}
            orderId={getOrderDisplayId(order)}
            description={
              formatOrderTypeLabel(order.order_type) +
              (order.due_date ? ` · Due ${formatDateDMY(order.due_date)}` : '')
            }
            amount={getOrderTotalFormatted(order)}
            selected={selectedOrderId === order.id}
            onClick={() => onSelectOrder(order.id)}
          />
        ))}
      </div>
    </div>
  ) : null;

  // Order-creation affordance: "New order"/"Create invoice" only for an ACTIVE
  // selected job (D7); an exited selection is view-only; no job at all points to
  // Add-to-pipeline (OQ-1). Hidden until the probe resolves.
  const jobAction = !jobsResolved ? null : activeSelectedJob ? (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleNewOrder}
        disabled={resolvingPerson}
        className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg border border-gardens-bdr text-gardens-tx bg-white hover:bg-gardens-page focus:outline-none focus:ring-2 focus:ring-gardens-grn/30 disabled:opacity-50"
      >
        {resolvingPerson ? 'Preparing…' : 'New order'}
      </button>
      {uninvoicedJobOrders.length > 0 && (
        <button
          type="button"
          onClick={() => setInvoiceDrawerOpen(true)}
          className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg border border-gardens-bdr text-gardens-tx bg-white hover:bg-gardens-page focus:outline-none focus:ring-2 focus:ring-gardens-grn/30"
        >
          Create invoice
        </button>
      )}
    </div>
  ) : effectiveJob ? (
    <p className="text-[11px] text-gardens-txs">Exited job — orders are view-only</p>
  ) : (
    <p className="text-[11px] text-gardens-txs">Add to pipeline to create orders</p>
  );

  // S5 exception: a job-linked conversation without a resolvable person still gets
  // the creation entry point (person is created/deduped on click).
  if (!personId && !effectiveJob) {
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
            Order context {jobOrders.length > 0 && `(${jobOrders.length})`}
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
        ) : jobOrders.length === 0 && unassignedOrders.length === 0 ? (
          <div className="text-center text-gardens-txs text-sm py-4 space-y-2">
            <p>{effectiveJob ? 'No orders for this job yet' : 'No orders for this person yet'}</p>
            {jobAction && <div className="flex justify-center">{jobAction}</div>}
          </div>
        ) : (
          <>
            {displayOrder && (
              <div
                ref={summaryRef}
                className={
                  summaryFlash
                    ? 'rounded-xl ring-2 ring-gardens-grn/40 transition-shadow'
                    : 'transition-shadow'
                }
              >
                <OrderContextSummary order={displayOrder} />
              </div>
            )}
            {jobOrders.length > 0 ? (
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between px-0.5 mb-1.5">
                  <p className={cn(SECTION_LABEL)}>Orders</p>
                  {jobAction}
                </div>
                <div className="space-y-1">
                  {jobOrders.map((order) => (
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
                        if (selectedOrderId === order.id || jobOrders.length === 1) {
                          summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          setSummaryFlash(true);
                          window.setTimeout(() => setSummaryFlash(false), 900);
                          return;
                        }
                        onSelectOrder(order.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-gardens-txs text-sm py-4 space-y-2">
                <p>{effectiveJob ? 'No orders for this job yet' : 'No jobs in the pipeline yet'}</p>
                {jobAction && <div className="flex justify-center">{jobAction}</div>}
              </div>
            )}
            {unassignedSection}
          </>
        )}
      </div>

      <CreateOrderDrawer
        open={orderDrawerOpen}
        onOpenChange={setOrderDrawerOpen}
        initialJobId={effectiveJob?.id ?? null}
        initialPersonId={effectivePersonId}
        initialCustomerEmail={person?.email ?? undefined}
        initialCustomerPhone={person?.phone ?? undefined}
        onOrderCreated={onSelectOrder}
      />

      <CreateInvoiceDrawer
        open={invoiceDrawerOpen}
        onOpenChange={setInvoiceDrawerOpen}
        preloadedOrders={uninvoicedJobOrders}
        jobId={effectiveJob?.id ?? null}
        initialPersonId={effectivePersonId}
      />
    </div>
  );
};
