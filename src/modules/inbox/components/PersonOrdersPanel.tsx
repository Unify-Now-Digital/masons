import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Clock, FileText, Package, User } from 'lucide-react';
import { useOrdersByJobId, useOrdersByPersonId } from '@/modules/orders/hooks/useOrders';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { getOrderPermitCost, getOrderTotal, getOrderTotalFormatted } from '@/modules/orders/utils/orderCalculations';
import { formatOrderTypeLabel } from '@/modules/orders/utils/orderTypeDisplay';
import { CreateOrderDrawer } from '@/modules/orders/components/CreateOrderDrawer';
import { CreateInvoiceDrawer } from '@/modules/invoicing';
import { useConversationsJobs, useJobsByPersonId, resolvePersonId } from '@/modules/jobsPipeline';
import { effectiveJobId } from '@/modules/inbox/utils/jobPickerLabels';
import { useMinWidth } from '@/modules/inbox/hooks/useMinWidth';
import { useOrderPrefill } from '@/modules/inbox/hooks/useOrderPrefill';
import { useCustomer, customersKeys } from '@/modules/customers/hooks/useCustomers';
import { displayPersonName } from '@/shared/lib/personName';
import { useConversation } from '@/modules/inbox/hooks/useInboxConversations';
import { linkConversation } from '@/modules/inbox/api/inboxConversations.api';
import { OrderContextPanel } from '@/modules/orders/components/OrderContextPanel';
import { InboxContactTab } from '@/modules/inbox/components/InboxContactTab';
import { InboxEnquiryCard } from '@/modules/inbox/components/InboxEnquiryCard';
import { useQuoteEnquiriesByPersonId } from '@/modules/inbox/hooks/useQuoteEnquiriesByPersonId';
import { InboxHistoryTab } from '@/modules/inbox/components/InboxHistoryTab';
import { EditCustomerDrawer } from '@/modules/customers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { InboxOrderListRow } from '@/modules/inbox/components/InboxOrderListRow';
import type { Order } from '@/modules/orders/types/orders.types';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { canBuildInvoices } from '@/modules/invoicing/invoiceBuilderAccess';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/utils';
import { PANEL_PRIMARY, PanelBlock, PanelHeader, useSectionState } from '@/shared/components/mason';
import { SidePanel } from '@/shared/components/panel/SidePanel';
import { DockedContext } from '@/shared/components/mason/DockedContext';
import { dockContactLine } from '@/shared/components/mason/dockFacts';
import type { ActivityEvent } from '@/modules/today/recentActivity';
import { formatDateDMY } from '@/shared/lib/formatters';
import { panelMoney } from '@/shared/lib/contextPanel';
import { useOrderPaymentsByOrder } from '@/modules/payments/hooks/useOrderPaymentsByOrder';

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
  /** True while the order form is open in side presentation (drives the page grid / list collapse). */
  onOrderFormOpenChange?: (open: boolean) => void;
  /** Fires true when there is nothing to show (no linked person and no job), so the page can slim the rail. */
  onEmptyChange?: (empty: boolean) => void;
  /** The parent shell already draws the close button. */
  hideClose?: boolean;
  /** Outline controls beside close (for example Open conversation). */
  headerActions?: React.ReactNode;
  /** In-flow Today column. The inbox rail stays the overlay. */
  variant?: 'overlay' | 'docked';
  onOpenFull?: () => void;
  activity?: ActivityEvent[];
  kindLabel?: string;
  channel?: string | null;
  /** Selected thread that is not linked to a person. */
  unlinkedContact?: { name: string; handle: string; channel: string } | null;
  onLinkPerson?: () => void;
}

const SECTION_LABEL = 'text-xs font-semibold text-gardens-txs';

type SidebarCard = 'orders' | 'contact' | 'history';

/** What the order form was opened for. The drawer reads only this, never live props. */
interface OrderFormSnapshot {
  personId: string;
  jobId: string | null;
  /** undefined at open = not loaded yet; may be filled once (same person only). */
  email: string | undefined;
  phone: string | undefined;
  presentation: 'modal' | 'side';
}
// Card bodies are forceMounted; hiding is the static data-state class only. No display
// utility here — keeps data-[state=closed]:hidden (and Radix's hidden attr) effective on
// forceMounted content (AC-002/FR-003). Scroll lives on the column container, not per card.
const CARD_BODY_CLASSES = 'px-3 py-3 space-y-3 data-[state=closed]:hidden';
// 'group' so the chevron keys off the trigger's data-state (Radix stamps the trigger, not children).
// FR-015: headers carry the column's structure now that the panel has no dividing rules, so
// they sit at full text contrast (tx, semibold); icon, count and chevron inherit currentColor.
// The hover affordance moved to a surface tint — the old hover:text-gardens-tx is the base.
export const PersonOrdersPanel: React.FC<PersonOrdersPanelProps> = ({
  personId,
  conversationIds,
  selectedJobId,
  selectedOrderId,
  onSelectOrder,
  onCloseOrder,
  onOrdersCountChange,
  onOrderFormOpenChange,
  onEmptyChange,
  hideClose,
  headerActions,
  variant = 'overlay',
  onOpenFull,
  activity = [],
  kindLabel,
  channel,
  unlinkedContact = null,
  onLinkPerson,
}) => {
  const { organizationId } = useOrganization();
  const canBuildInvoice = canBuildInvoices(useCanSeeMoney());
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: orders = [], isLoading, error } = useOrdersByPersonId(personId);
  // FR-7 (amended): person-scoped orphans (job_id = null) never silently vanish
  // from the sidebar — rendered display-only in the Unassigned subsection.
  const unassignedOrders = useMemo(() => orders.filter((o) => o.job_id === null), [orders]);

  // Linked-job probe (same queries the conversation views run — cache-shared).
  // Orders created here attach to the SELECTED active job (D7). Linked persons
  // probe by person_id (list-derived conversationIds can be search-filtered);
  // unlinked selections keep the conversation-keyed probe.
  const personJobsQuery = useJobsByPersonId(personId);
  const conversationJobsQuery = useConversationsJobs(personId ? undefined : conversationIds);
  const jobsQuery = personId ? personJobsQuery : conversationJobsQuery;
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
  const { data: quoteEnquiries = [], isLoading: quoteEnquiriesLoading } =
    useQuoteEnquiriesByPersonId(effectivePersonId);
  const { data: s5Conversation } = useConversation(
    !personId && activeSelectedJob ? activeSelectedJob.conversation_id : null
  );

  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [orderFormSnapshot, setOrderFormSnapshot] = useState<OrderFormSnapshot | null>(null);
  const [orderFormDirty, setOrderFormDirty] = useState(false);
  const isWide = useMinWidth(1024);
  const [orderFormGeneration, setOrderFormGeneration] = useState(0);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = useState(false);
  useEffect(() => {
    if (!canBuildInvoice && invoiceDrawerOpen) setInvoiceDrawerOpen(false);
  }, [canBuildInvoice, invoiceDrawerOpen]);
  const [invoiceKind, setInvoiceKind] = useState<'deposit' | 'balance'>('deposit');
  const [openCards, setOpenCards] = useState<Record<SidebarCard, boolean>>({
    orders: true, contact: true, history: true, // R-002: all expanded by default
  });
  const toggleCard = (card: SidebarCard) => (open: boolean) =>
    setOpenCards((prev) => ({ ...prev, [card]: open }));
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const { isOpen, toggle } = useSectionState();

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

  // D-3: email / phone that were undefined at open are filled once from the live person, only
  // while it is still the snapshot's person. Never overwritten once set; personId / jobId never.
  useEffect(() => {
    if (!orderDrawerOpen || !orderFormSnapshot || !person) return;
    if (effectivePersonId !== orderFormSnapshot.personId || person.id !== orderFormSnapshot.personId) return;
    const email = orderFormSnapshot.email === undefined ? person.email ?? undefined : undefined;
    const phone = orderFormSnapshot.phone === undefined ? person.phone ?? undefined : undefined;
    if (email === undefined && phone === undefined) return;
    setOrderFormSnapshot({
      ...orderFormSnapshot,
      email: orderFormSnapshot.email ?? email,
      phone: orderFormSnapshot.phone ?? phone,
    });
  }, [orderDrawerOpen, orderFormSnapshot, person, effectivePersonId]);

  // R-003: the open form belongs to the snapshot's person. A different live person closes it
  // (dirty -> confirm first). A null live personId is "pending", not a different person.
  useEffect(() => {
    if (!orderDrawerOpen || !orderFormSnapshot) return;
    if (!personId || personId === orderFormSnapshot.personId) return;
    if (orderFormDirty) setDiscardConfirmOpen(true);
    else setOrderDrawerOpen(false);
  }, [personId, orderDrawerOpen, orderFormSnapshot, orderFormDirty]);

  // Reports side-presentation open state to the page; false again on close and on unmount.
  const orderFormSideOpen = orderDrawerOpen && orderFormSnapshot?.presentation === 'side';
  useEffect(() => {
    onOrderFormOpenChange?.(orderFormSideOpen);
    return () => onOrderFormOpenChange?.(false);
  }, [orderFormSideOpen, onOrderFormOpenChange]);

  // Shell v2: the panel is "empty" (page closes it to zero width) whenever no order or
  // enquiry (job) is linked to the selection — a linked person with no orders/jobs too.
  const showingUnlinked = !personId && !effectiveJob && !!unlinkedContact;
  const panelEmpty = !showingUnlinked && jobsResolved && !isLoading && !effectiveJob && orders.length === 0 && !orderDrawerOpen;
  useEffect(() => {
    onEmptyChange?.(panelEmpty);
  }, [panelEmpty, onEmptyChange]);

  // One AI extraction per side-form open (FR-016), from the snapshot's person's open threads.
  const orderPrefill = useOrderPrefill({
    enabled: orderFormSideOpen,
    generation: orderFormGeneration,
    personId: orderFormSnapshot?.personId ?? null,
  });

  // R-011: reload / tab close with a dirty side form asks first. In-app navigation is not
  // guarded in v1 (the app has no navigation blocker).
  useEffect(() => {
    if (!orderFormSideOpen || !orderFormDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [orderFormSideOpen, orderFormDirty]);

  useEffect(() => {
    // A selectable job counts as context: keep the panel expanded so the "New
    // order" entry point is visible before the first order exists. Count follows
    // the displayed set (job-scoped + unassigned orphans, FR-7). A quote enquiry
    // counts too (no job for contact-led enquirers); wait for it so the panel
    // does not collapse and then re-open.
    if (!isLoading && !quoteEnquiriesLoading)
      onOrdersCountChange?.(
        jobOrders.length + unassignedOrders.length ||
          (effectiveJob || quoteEnquiries.length > 0 ? 1 : 0),
      );
  }, [
    jobOrders.length,
    unassignedOrders.length,
    isLoading,
    quoteEnquiriesLoading,
    quoteEnquiries.length,
    onOrdersCountChange,
    effectiveJob,
  ]);

  // Single open routine for both sites. personId and jobId are pinned here and never change
  // after open; presentation is the viewport at click time and does not swap on resize.
  const openOrderForm = (snapshotPersonId: string, knownPerson: typeof person) => {
    setOrderFormSnapshot({
      personId: snapshotPersonId,
      jobId: effectiveJob?.id ?? null,
      email: knownPerson?.email ?? undefined,
      phone: knownPerson?.phone ?? undefined,
      presentation: isWide ? 'side' : 'modal',
    });
    setOrderFormDirty(false);
    // Fresh form per open: a prop-driven close (X, Cancel, Discard, silent close) never resets it.
    setOrderFormGeneration((g) => g + 1);
    setOrderDrawerOpen(true);
  };

  const handleNewOrder = async () => {
    if (effectivePersonId) {
      openOrderForm(effectivePersonId, person);
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
      // S5: the closure's effectivePersonId / person are stale here; use the local id only.
      openOrderForm(newPersonId, undefined);
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
    if (isLoading || orders.length === 0 || !personId) return;
    if (autoSelectedPersonRef.current === personId) return;
    // Done only once a selection for this person has landed: the page clears selectedOrderId
    // on a person or job switch in its own effects, which run after this one and would
    // otherwise overwrite the auto-select on a cached switch.
    if (selectedOrderId && orders.some((o) => o.id === selectedOrderId)) {
      autoSelectedPersonRef.current = personId;
      return;
    }
    onSelectOrder(orders[0].id);
  }, [isLoading, orders, personId, selectedOrderId, onSelectOrder]);

  const displayOrder = selectedOrderId
    ? [...jobOrders, ...unassignedOrders].find((o) => o.id === selectedOrderId) ??
      jobOrders[0] ??
      null
    : jobOrders[0] ?? null;
  const orderPayments = useOrderPaymentsByOrder(displayOrder?.id ?? null);
  const paymentsReceived = displayOrder
    ? panelMoney(getOrderTotal(displayOrder), getOrderPermitCost(displayOrder), orderPayments.data ?? []).paid
    : 0;
  const openInvoice = (kind: 'deposit' | 'balance') => {
    setInvoiceKind(kind);
    setInvoiceDrawerOpen(true);
  };

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
            amount={canBuildInvoice ? getOrderTotalFormatted(order) : ''}
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
    canBuildInvoice && uninvoicedJobOrders.length > 0 && !(displayOrder && !displayOrder.invoice_id) ? (
      <button
        type="button"
        onClick={() => openInvoice('deposit')}
        className="inline-flex min-h-11 items-center rounded-lg border border-gardens-bdr bg-white px-3 text-[13px] font-semibold text-gardens-tx hover:bg-gardens-page focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc"
      >
        Create invoice
      </button>
    ) : null
  ) : effectiveJob ? (
    <p className="m-0 text-xs text-gardens-txs">Exited job — orders are view-only</p>
  ) : (
    <p className="m-0 text-xs text-gardens-txs">Add to pipeline to create orders</p>
  );

  // Section 7 "Other orders": every order for this customer (person-wide), plus job orders
  // when the selection has no person yet. One list only — the old ORD card + second
  // ORDERS list + Unassigned subsection are merged here.
  const customerOrders = useMemo(() => {
    const seen = new Set<string>();
    return [...orders, ...jobOrders].filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
  }, [orders, jobOrders]);
  const canCreateOrder = jobsResolved && !!activeSelectedJob;
  const newOrderHint = !jobsResolved ? null : effectiveJob ? 'Exited job — orders are view-only' : 'Add to pipeline to create orders';
  const enquiryCard =
    !isLoading && !quoteEnquiriesLoading && quoteEnquiries.length > 0 ? (
      <PanelBlock id="enquiry" title="Enquiry" icon={FileText} open={isOpen('enquiry')} onToggle={toggle} aside={quoteEnquiries.length > 1 ? quoteEnquiries.length : undefined}>
        <InboxEnquiryCard
          key={effectivePersonId ?? ''}
          enquiries={quoteEnquiries}
          hasOrders={orders.length > 0 || jobOrders.length > 0}
          bodyOnly
          triggerClassName=""
          bodyClassName=""
          sectionLabelClassName={SECTION_LABEL}
        />
      </PanelBlock>
    ) : null;

  // One element, rendered as a direct child of BOTH root divs below with the same key, so the
  // open form (and its draft) survives the early return on a same-person thread switch.
  const createOrderDrawer = (
    <React.Fragment key="create-order">
      <CreateOrderDrawer
        key={orderFormGeneration}
        open={orderDrawerOpen}
        onOpenChange={setOrderDrawerOpen}
        initialJobId={orderFormSnapshot?.jobId ?? null}
        initialPersonId={orderFormSnapshot?.personId ?? null}
        initialCustomerEmail={orderFormSnapshot?.email}
        initialCustomerPhone={orderFormSnapshot?.phone}
        presentation={orderFormSnapshot?.presentation ?? 'modal'}
        onDirtyChange={setOrderFormDirty}
        onOrderCreated={onSelectOrder}
        prefill={orderPrefill}
      />
      <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <AlertDialogContent className="z-[60]">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this order draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The order form was opened for a different customer. Discard it, or keep editing it
              for the customer it was opened for.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscardConfirmOpen(false);
                setOrderDrawerOpen(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </React.Fragment>
  );

  if (variant === 'docked') {
    const shown = displayOrder ?? orders[0] ?? null;
    const rest = customerOrders.filter((order) => order.id !== shown?.id);
    const latest = [...rest].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
    const enquiry = quoteEnquiries[0];
    const productName = shown
      ? (shown.custom_product_name?.trim() || shown.quote_product_name?.trim() || formatOrderTypeLabel(shown.order_type))
      : enquiry?.name ?? null;
    const specLine = shown
      ? [shown.material, shown.color].filter(Boolean).join(' · ')
      : [enquiry?.colour, enquiry?.size].filter(Boolean).join(' · ');
    const facts = shown
      ? [
          { label: 'Order', value: getOrderDisplayId(shown) },
          { label: 'Stage', value: shown.job?.stage ? String(shown.job.stage).replace(/_/g, ' ') : 'In progress' },
          { label: 'Cemetery', value: shown.location || '—' },
        ]
      : enquiry
        ? [{ label: 'Quote', value: enquiry.name }]
        : [];
    return (
      <DockedContext
        testId="person-panel"
        kindLabel={kindLabel ?? (customerOrders.length > 0 ? 'Customer' : 'Enquiry')}
        name={displayPersonName(person?.first_name, person?.last_name) || 'Customer'}
        contact={dockContactLine(person?.email, person?.phone, channel)}
        onOpenFull={onOpenFull}
        events={activity}
        recordLabel={shown ? 'Order' : 'Quote'}
        productName={productName}
        productHref={shown ? `/dashboard/orders?order=${encodeURIComponent(shown.id)}` : null}
        specLine={specLine || null}
        imageUrl={shown?.product_photo_url ?? enquiry?.imageUrl ?? null}
        facts={facts}
        otherOrders={rest.length === 0 || !latest ? 'None' : `${rest.length} · ${getOrderDisplayId(latest)}`}
      />
    );
  }

  // S5 exception: a job-linked conversation without a resolvable person still gets
  // the creation entry point (person is created/deduped on click).
  if (!personId && !effectiveJob) {
    if (unlinkedContact) {
      return (
        <SidePanel
          mode="inline"
          label="Unlinked contact"
          testId="unlinked-contact-panel"
          kicker={unlinkedContact.channel}
          name={unlinkedContact.name}
          source={unlinkedContact.handle}
        >
          <div className="flex flex-col gap-3 px-4 py-4">
            <p className="m-0 text-sm text-gardens-txs">This conversation is not linked to a customer yet.</p>
            <button type="button" data-testid="link-to-person" className={PANEL_PRIMARY} onClick={onLinkPerson}>
              Link to person
            </button>
          </div>
          {createOrderDrawer}
        </SidePanel>
      );
    }
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <p className="text-center text-gardens-txs text-sm">
            Order context is available when a linked customer is selected
          </p>
        </div>
        {createOrderDrawer}
      </div>
    );
  }

  const personName = displayPersonName(person?.first_name, person?.last_name) || 'Customer';
  const newOrderAction = canCreateOrder ? (
    <button
      type="button"
      data-testid="panel-primary"
      className={PANEL_PRIMARY}
      onClick={() => { void handleNewOrder(); }}
      disabled={resolvingPerson}
    >
      {resolvingPerson ? 'Preparing…' : 'New order'}
    </button>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gardens-surf2">
      {isLoading ? (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pt-3">
          <Skeleton className="h-28 w-full rounded-xl bg-gardens-bdr/80" />
          <Skeleton className="h-10 w-full rounded-lg bg-gardens-bdr/80" />
          <Skeleton className="h-10 w-full rounded-lg bg-gardens-bdr/80" />
        </div>
      ) : error ? (
        <div className="px-4 py-3 text-sm text-gardens-red-dk">
          {error instanceof Error ? error.message : 'Failed to load orders'}
        </div>
      ) : displayOrder ? (
        <div ref={summaryRef} className={cn('flex min-h-0 flex-1 flex-col', summaryFlash && 'ring-2 ring-gardens-acc/40')}>
          <OrderContextPanel
            key={displayOrder.id}
            className="min-h-0 flex-1"
            order={displayOrder}
            person={person}
            customerOrders={customerOrders}
            onSelectOrder={onSelectOrder}
            onNewOrder={canCreateOrder ? handleNewOrder : undefined}
            newOrderBusy={resolvingPerson}
            newOrderHint={newOrderHint}
            onCreateInvoice={canBuildInvoice && activeSelectedJob && uninvoicedJobOrders.length > 0 ? (kind) => openInvoice(kind === 'balance' ? 'balance' : 'deposit') : undefined}
            onEditContact={() => setEditDrawerOpen(true)}
            headerActions={headerActions}
            onClose={hideClose ? undefined : onCloseOrder}
            showOpenFullOrder
            before={enquiryCard}
            extraSections={[{ id: 'history', title: 'History', icon: Clock, node: <InboxHistoryTab jobs={jobsQuery.data} /> }]}
          />
        </div>
      ) : (
        <>
          <PanelHeader
            kicker={quoteEnquiries.length > 0 ? 'Enquiry' : 'Person'}
            name={personName}
            action={newOrderAction}
            extra={headerActions}
            onClose={hideClose ? undefined : onCloseOrder}
          />
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-6">
            {enquiryCard}
            <div className="px-6 py-3 text-sm text-gardens-txs">
              <p className="m-0">{effectiveJob ? 'No orders for this job yet' : 'No orders for this person yet'}</p>
              {jobAction && <div className="mt-2">{jobAction}</div>}
            </div>
            <PanelBlock id="contact" title="Contact" icon={User} open={isOpen('contact')} onToggle={toggle}>
              <InboxContactTab
                hasLinkedPerson={effectivePersonId != null}
                person={person}
                onEdit={() => setEditDrawerOpen(true)}
              />
            </PanelBlock>
          </div>
        </>
      )}

      {createOrderDrawer}

      {canBuildInvoice && (
        <CreateInvoiceDrawer
          open={invoiceDrawerOpen}
          onOpenChange={setInvoiceDrawerOpen}
          preloadedOrders={uninvoicedJobOrders}
          alreadyPaid={invoiceKind === 'balance' ? (orderPayments.isSuccess ? paymentsReceived : null) : 0}
          jobId={effectiveJob?.id ?? null}
          initialPersonId={effectivePersonId}
        />
      )}

      <EditCustomerDrawer
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        customer={person ?? null}
      />
    </div>
  );
};
