import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/shared/hooks/use-toast';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { ConversationView } from "../components/ConversationView";
import { InboxConversationList, type ListFilter, type ChannelFilter } from "../components/InboxConversationList";
import { CustomerThreadList } from "../components/CustomerThreadList";
import { CustomerConversationView } from "../components/CustomerConversationView";
import { PersonOrdersPanel } from "../components/PersonOrdersPanel";
import { BulkDeleteConversationsDialog } from "@/modules/inbox/components/BulkDeleteConversationsDialog";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { ChevronLeft, MessageSquareText, Package, PanelLeftOpen, PanelRightClose } from "lucide-react";
import {
  inboxKeys,
  useConversationsList,
  useConversation,
  useCreateConversation,
  useMarkAsRead,
  useMarkAsUnread,
  useDeleteConversations,
  useSyncGmail,
} from "@/modules/inbox/hooks/useInboxConversations";
import { NewConversationModal, type NewConversationResult } from "@/modules/inbox/components/NewConversationModal";
import { useGmailConnection } from "@/modules/inbox/hooks/useGmailConnection";
import { gmailConnectionKeys } from "@/modules/inbox/hooks/useGmailConnection";
import type { ConversationFilters, CustomersSelection } from "@/modules/inbox/types/inbox.types";
import {
  customersSelectionsEqual,
  customersSelectionFromRow,
  customerThreadRowStableKey,
} from "@/modules/inbox/types/inbox.types";
import { cn } from "@/shared/lib/utils";
import { useCustomerThreads } from '../hooks/useCustomerThreads';
import { useOrdersByPersonIds } from '@/modules/orders/hooks/useOrders';
import { useCemeteries } from '@/modules/permitTracker/hooks/useCemeteries';
import { useEnquiryExtractions } from '@/modules/inbox/hooks/useEnquiryExtractions';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import {
  classifyConversation,
  computeAging,
  deriveBallInCourt,
  buildCemeteryEmailSet,
  buildPermitThreadIdSet,
  buildPersonHasOpenOrdersSet,
  buildOrderById,
  type AgingInfo,
  type InboxBucket,
} from '@/modules/inbox/utils/inboxBuckets';

const REALTIME_DEBOUNCE_MS = 200;
const GMAIL_POLL_INTERVAL_MS = 10_000;
const INBOX_FALLBACK_REFRESH_MS = 20_000;
const MAX_BULK_DELETE_CONVERSATIONS = 50;

/** Stable reference when the query has no data yet — avoids a fresh [] each render churning displayConversations identity. */
const EMPTY_DISPLAY_CONVERSATIONS: [] = [];

export const UnifiedInboxPage: React.FC = () => {
  const isMobile = useIsMobile();
  const { organizationId } = useOrganization();

  // Default tab on first load: Customers.
  // Persist tab choice in localStorage so we can restore it on next visit
  // without a post-mount visual flip.
  const VIEW_MODE_STORAGE_KEY = 'inbox.desktop.viewMode.v1';
  const [viewMode, setViewMode] = useState<'conversations' | 'customers'>(() => {
    try {
      const stored = localStorage.getItem('inbox.desktop.viewMode.v1');
      if (stored === 'conversations' || stored === 'customers') return stored;
    } catch {
      // ignore storage issues
    }
    return 'customers';
  });
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  /** Conversations tab only: left-panel + thread navigation (which conversation to open). */
  const [conversationsChannelFilter, setConversationsChannelFilter] = useState<ChannelFilter>('all');
  /** Customers tab only: left-panel list filter (independent of composer send channel). */
  const [customersListChannelFilter, setCustomersListChannelFilter] = useState<ChannelFilter>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedCustomerRowKeys, setSelectedCustomerRowKeys] = useState<Set<string>>(() => new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteConversationIds, setBulkDeleteConversationIds] = useState<string[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [customersSelection, setCustomersSelection] = useState<CustomersSelection | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [newConversationModalOpen, setNewConversationModalOpen] = useState(false);
  const [emptyChannelStartContext, setEmptyChannelStartContext] = useState<{
    personId: string | null;
    channel: 'email' | 'sms' | 'whatsapp';
  } | null>(null);
  const [newConversationPrefill, setNewConversationPrefill] = useState<{
    initialChannel: 'email' | 'whatsapp';
    initialPersonId: string;
  } | null>(null);
  const [markedReadIds, setMarkedReadIds] = useState<Set<string>>(() => new Set());
  /** Conversations the user marked unread while still selected — blocks auto-mark-as-read until selection changes or user marks read. */
  const userForcedUnreadIds = useRef<Set<string>>(new Set());
  /** After mark-unread we clear `customersSelection`; when true, skip auto-selecting the first customer row so the thread panel stays empty until the user picks a row. */
  const suppressCustomersAutoSelectRef = useRef(false);
  const userSelectedRef = useRef(false);
  const autoReadOnceRef = useRef<Set<string>>(new Set());
  const autoReadCustomersRef = useRef<Set<string>>(new Set());
  const realtimePendingIdsRef = useRef<Set<string>>(new Set());
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidateInFlightRef = useRef(false);

  // Desktop-only collapsible side panels:
  // - Left: conversations/customers list
  // - Right: order context panel
  // State is persisted per user via localStorage.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const rightManualOverride = useRef(false);

  // Avoid showing rails during the first client render before mobile/desktop is known.
  const [layoutReady, setLayoutReady] = useState(false);
  useEffect(() => {
    setLayoutReady(true);
  }, []);

  const effectiveLeftCollapsed = layoutReady && !isMobile && leftCollapsed;
  const effectiveRightCollapsed = layoutReady && !isMobile && rightCollapsed;

  const leftStorageKey = currentUserId
    ? `inbox.desktop.leftCollapsed.v1.${currentUserId}`
    : null;
  const rightStorageKey = currentUserId
    ? `inbox.desktop.rightCollapsed.v1.${currentUserId}`
    : null;

  // Resolve user id for per-user persistence.
  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (cancelled) return;
        setCurrentUserId(user?.id ?? "anon");
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentUserId("anon");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load persisted collapsed state.
  useEffect(() => {
    if (!leftStorageKey || !rightStorageKey) return;
    try {
      const storedLeft = localStorage.getItem(leftStorageKey);
      const storedRight = localStorage.getItem(rightStorageKey);
      setLeftCollapsed(storedLeft === "true");
      setRightCollapsed(storedRight === "true");
    } catch {
      // Keep defaults (both open).
    }
  }, [leftStorageKey, rightStorageKey]);

  // Persist collapsed state (desktop only).
  useEffect(() => {
    if (!leftStorageKey || !rightStorageKey) return;
    if (isMobile) return;
    try {
      localStorage.setItem(leftStorageKey, String(leftCollapsed));
      localStorage.setItem(rightStorageKey, String(rightCollapsed));
    } catch {
      // Ignore persistence issues.
    }
  }, [leftStorageKey, rightStorageKey, isMobile, leftCollapsed, rightCollapsed]);

  // Persist tab choice whenever it changes (no state changes here).
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // ignore persistence issues
    }
  }, [VIEW_MODE_STORAGE_KEY, viewMode]);

  useEffect(() => {
    if (viewMode !== 'conversations') {
      setEmptyChannelStartContext(null);
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'customers') {
      suppressCustomersAutoSelectRef.current = false;
    }
  }, [viewMode]);

  const { data: selectedConversation } = useConversation(selectedConversationId);
  const activePersonId = (
    viewMode === 'customers'
      ? customersSelection?.type === 'linked'
        ? customersSelection.personId
        : null
      : selectedConversation?.person_id ?? null
  ) as string | null;

  const handleOrdersCountChange = useCallback((count: number) => {
    if (!rightManualOverride.current) {
      setRightCollapsed(count === 0);
    }
  }, []);

  useEffect(() => {
    rightManualOverride.current = false;
    setSelectedOrderId(null);
  }, [activePersonId]);

  // Build base API filters from list filter and search (no channel or person_id; unlinked is a filter option)
  const baseFilters = useMemo<ConversationFilters>(() => {
    const base: ConversationFilters = { status: 'open' };
    if (listFilter === 'unread') base.unread_only = true;
    if (listFilter === 'unlinked') base.unlinked_only = true;
    if (searchQuery.trim()) base.search = searchQuery;
    return base;
  }, [listFilter, searchQuery]);

  // Conversations tab: channel filter on the conversation list + thread navigation.
  const conversationsListFilters = useMemo<ConversationFilters>(() => {
    if (conversationsChannelFilter === 'all') return baseFilters;
    return { ...baseFilters, channel: conversationsChannelFilter };
  }, [baseFilters, conversationsChannelFilter]);

  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  // Channel-filtered conversations: Conversations tab left panel only.
  const { data: conversations, isLoading, isError } = useConversationsList(conversationsListFilters);
  // All-channel conversations for the same filters: used by Reply via pills so they
  // can always search across every channel regardless of the left-panel filter.
  const { data: allConversations } = useConversationsList(baseFilters);

  const conversationsWithDisplayUnread = useMemo(() => {
    if (!conversations) return undefined;
    return conversations.map((c) =>
      markedReadIds.has(c.id) ? { ...c, unread_count: 0 } : c
    );
  }, [conversations, markedReadIds]);

  const allConversationsDisplay = useMemo(() => {
    if (!allConversations) return undefined;
    return allConversations.map((c) =>
      markedReadIds.has(c.id) ? { ...c, unread_count: 0 } : c
    );
  }, [allConversations, markedReadIds]);

  const {
    rows: customerRows,
    isLoading: customersLoading,
    isError: customersError,
  } = useCustomerThreads({
    baseFilters,
    channelFilter: customersListChannelFilter,
    listFilter: listFilter === 'stuck' ? 'all' : listFilter,
  });

  const selectedCustomersRow = useMemo(() => {
    if (!customersSelection) return null;
    return (
      customerRows.find((r) =>
        customersSelectionsEqual(customersSelectionFromRow(r), customersSelection)
      ) ?? null
    );
  }, [customerRows, customersSelection]);

  const customerRowsByKey = useMemo(
    () => new Map(customerRows.map((row) => [customerThreadRowStableKey(row), row])),
    [customerRows],
  );

  const selectedCustomerRows = useMemo(
    () => Array.from(selectedCustomerRowKeys).map((key) => customerRowsByKey.get(key)).filter(Boolean),
    [selectedCustomerRowKeys, customerRowsByKey],
  );

  const selectedCustomerConversationIds = useMemo(() => {
    const unique = new Set<string>();
    selectedCustomerRows.forEach((row) => {
      row.conversationIds.forEach((id) => unique.add(id));
    });
    return Array.from(unique);
  }, [selectedCustomerRows]);

  const createConversationMutation = useCreateConversation();
  const markAsReadMutation = useMarkAsRead();
  const markAsUnreadMutation = useMarkAsUnread();
  const deleteMutation = useDeleteConversations();
  const syncGmailMutation = useSyncGmail();
  const { data: gmailConnection } = useGmailConnection();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const gmailPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncGmailMutationRef = useRef(syncGmailMutation);
  syncGmailMutationRef.current = syncGmailMutation;
  const markAsReadMutateRef = useRef(markAsReadMutation.mutate);
  markAsReadMutateRef.current = markAsReadMutation.mutate;
  const markAsReadIsPendingRef = useRef(markAsReadMutation.isPending);
  markAsReadIsPendingRef.current = markAsReadMutation.isPending;
  const previousSelectedConversationIdRef = useRef<string | null>(null);
  const invalidateInboxData = useMemo(
    () => async () => {
      if (invalidateInFlightRef.current) return;
      invalidateInFlightRef.current = true;
      try {
        await queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
        if (activePersonId && organizationId) {
          await queryClient.invalidateQueries({
            queryKey: ['inbox', 'customerMessages', activePersonId, organizationId],
          });
        }
      } finally {
        invalidateInFlightRef.current = false;
      }
    },
    [queryClient, activePersonId, organizationId]
  );

  // After Gmail OAuth callback: show toast and clear ?gmail=connected from URL
  useEffect(() => {
    if (searchParams.get('gmail') === 'connected') {
      queryClient.invalidateQueries({ queryKey: gmailConnectionKeys.active });
      toast({ title: 'Gmail connected', description: 'Email will sync from now onward.' });
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('gmail');
        return next;
      }, { replace: true });
    }
  }, [searchParams, queryClient, toast, setSearchParams]);

  const conversationsById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof conversations>[number]>();
    conversationsWithDisplayUnread?.forEach((conversation) => {
      map.set(conversation.id, conversation);
    });
    return map;
  }, [conversationsWithDisplayUnread]);

  const conversationsByIdRef = useRef(conversationsById);
  conversationsByIdRef.current = conversationsById;

  // ---- Bucket / aging classification (single source of truth) ------------
  // Inputs are derived once at the page level and passed down to children so
  // we never duplicate the orders/cemeteries fetch or the bucket math.
  // `allConversationsDisplay` is the channel-unfiltered set so the "stuck"
  // header counter and filter reflect the full open inbox, not just what
  // happens to be visible after a channel/list filter.
  const personIdsForBucketing = useMemo(
    () =>
      [
        ...new Set(
          (allConversationsDisplay ?? [])
            .map((c) => c.person_id)
            .filter(Boolean)
        ),
      ] as string[],
    [allConversationsDisplay]
  );
  const { data: ordersForBucketing = [] } = useOrdersByPersonIds(personIdsForBucketing);
  const { data: cemeteries = [] } = useCemeteries();

  const allConversationIds = useMemo(
    () => (allConversationsDisplay ?? []).map((c) => c.id),
    [allConversationsDisplay]
  );
  const { data: extractions = [] } = useEnquiryExtractions(allConversationIds);
  const extractionByConversationId = useMemo(() => {
    const map = new Map<string, typeof extractions[number]>();
    for (const e of extractions) map.set(e.conversation_id, e);
    return map;
  }, [extractions]);

  const cemeteryEmailSet = useMemo(
    () => buildCemeteryEmailSet(cemeteries, ordersForBucketing),
    [cemeteries, ordersForBucketing]
  );
  const permitThreadIdSet = useMemo(
    () => buildPermitThreadIdSet(ordersForBucketing),
    [ordersForBucketing]
  );
  const personHasOpenOrdersSet = useMemo(
    () => buildPersonHasOpenOrdersSet(ordersForBucketing),
    [ordersForBucketing]
  );
  const orderById = useMemo(
    () => buildOrderById(ordersForBucketing),
    [ordersForBucketing]
  );

  // Tick `agingNow` once a minute so amber/red badges advance without a refetch.
  // Skip when the document is hidden — fallback poll already handles that case.
  const [agingNow, setAgingNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setAgingNow(Date.now());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  type BucketAging = { bucket: InboxBucket; aging: AgingInfo | null };
  const bucketAndAgingByConversationId = useMemo(() => {
    const map = new Map<string, BucketAging>();
    for (const c of allConversationsDisplay ?? []) {
      const linkedOrder = c.order_id ? orderById.get(c.order_id) ?? null : null;
      const personHasOpenOrders = c.person_id
        ? personHasOpenOrdersSet.has(c.person_id)
        : false;
      const bucket = classifyConversation(c, {
        cemeteryEmails: cemeteryEmailSet,
        permitThreadIds: permitThreadIdSet,
        personHasOpenOrders,
        extraction: extractionByConversationId.get(c.id) ?? null,
        linkedOrder,
      });
      const ball = deriveBallInCourt(c, agingNow);
      const aging = computeAging(ball, bucket);
      map.set(c.id, { bucket, aging });
    }
    return map;
  }, [
    allConversationsDisplay,
    cemeteryEmailSet,
    permitThreadIdSet,
    personHasOpenOrdersSet,
    orderById,
    extractionByConversationId,
    agingNow,
  ]);

  /** True total of stuck conversations across all open conversations (not filtered). */
  const stuckCount = useMemo(() => {
    let n = 0;
    bucketAndAgingByConversationId.forEach((entry) => {
      if (entry.aging?.isStuck) n += 1;
    });
    return n;
  }, [bucketAndAgingByConversationId]);

  /** Display order ids per person (for the small order-id annotation in rows). */
  const orderDisplayIdsByPersonId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const o of ordersForBucketing) {
      if (!o.person_id) continue;
      const list = map.get(o.person_id) ?? [];
      list.push(getOrderDisplayId(o));
      map.set(o.person_id, list);
    }
    return map;
  }, [ordersForBucketing]);

  // Client-side Urgent filter (no backend field): filter by subject/preview containing "urgent".
  // Stuck filter: items whose bucket-derived aging level is red (past SLA).
  // When neither, return `conversationsWithDisplayUnread` as-is so referential identity matches
  // React Query (stable across polls if data unchanged).
  const displayConversations = useMemo(() => {
    if (!conversationsWithDisplayUnread) return EMPTY_DISPLAY_CONVERSATIONS;
    if (listFilter === 'urgent') {
      return conversationsWithDisplayUnread.filter(
        (c) =>
          /urgent/i.test(c.subject ?? '') ||
          /urgent/i.test(c.last_message_preview ?? '')
      );
    }
    if (listFilter === 'stuck') {
      return conversationsWithDisplayUnread.filter(
        (c) => bucketAndAgingByConversationId.get(c.id)?.aging?.isStuck ?? false
      );
    }
    return conversationsWithDisplayUnread;
  }, [conversationsWithDisplayUnread, listFilter, bucketAndAgingByConversationId]);

  // Auto-select first (most recent) conversation on load or when selection is no longer in the visible list.
  // Does not touch autoReadOnceRef — guard cleanup runs only in the leave-conversation effect when selection id changes.
  useEffect(() => {
    if (viewMode !== 'conversations') return;
    if (emptyChannelStartContext) return;
    if (isLoading || isError) return;
    if (displayConversations.length === 0) {
      setSelectedConversationId(null);
      return;
    }
    if (!selectedConversationId || !displayConversations.some((conversation) => conversation.id === selectedConversationId)) {
      const firstId = displayConversations[0].id;
      if (firstId === selectedConversationId) return;
      setSelectedConversationId(firstId);
    }
  }, [displayConversations, isLoading, isError, selectedConversationId, viewMode, emptyChannelStartContext]);

  useEffect(() => {
    console.log('[AutoSelect] effect fired', {
      viewMode,
      customersLoading,
      customersSelectionType: customersSelection?.type,
      customersSelectionId: customersSelection?.type === 'linked'
        ? customersSelection.personId
        : customersSelection?.type === 'unlinked'
          ? `${customersSelection.channel}:${customersSelection.handle}`
          : null,
      customerRowsLength: customerRows.length,
      userSelectedRef: userSelectedRef.current,
      selectionFoundInRows: customerRows.some((row) =>
        customersSelectionsEqual(customersSelectionFromRow(row), customersSelection)
      ),
    });
    if (viewMode !== 'customers') return;
    if (customersLoading || customersError) return;
    userSelectedRef.current = false;
    if (customerRows.length === 0) {
      setCustomersSelection(null);
      suppressCustomersAutoSelectRef.current = false;
      return;
    }
    if (!customersSelection) {
      if (suppressCustomersAutoSelectRef.current) {
        return;
      }
      setCustomersSelection(customersSelectionFromRow(customerRows[0]));
      return;
    }
    if (
      !customerRows.some((row) =>
        customersSelectionsEqual(customersSelectionFromRow(row), customersSelection)
      )
    ) {
      if (userSelectedRef.current) {
        // User just selected this — customerRows may not have caught up yet.
        // Don't override. Clear the flag so future row removals still reset.
        userSelectedRef.current = false;
        return;
      }
      suppressCustomersAutoSelectRef.current = false;
      setCustomersSelection(customersSelectionFromRow(customerRows[0]));
    }
  }, [viewMode, customerRows, customersSelection, customersLoading, customersError]);

  // Customers mode: auto-mark all conversations for selected row as read on open (skipped if user marked unread for this row).
  // Uses markAsReadMutateRef + markAsReadIsPendingRef so useMarkAsRead() result identity does not retrigger this effect every render.
  useEffect(() => {
    if (viewMode !== 'customers') return;
    if (!selectedCustomersRow) return;
    if (markAsReadIsPendingRef.current) return;
    const row = selectedCustomersRow;
    const stableKey = customerThreadRowStableKey(row);
    if (userForcedUnreadIds.current.has(stableKey)) return;
    if (!row.hasUnread || row.conversationIds.length === 0) return;
    if (autoReadCustomersRef.current.has(stableKey)) return;

    autoReadCustomersRef.current.add(stableKey);
    markAsReadMutateRef.current(row.conversationIds, {
      onSuccess: () => {
        setMarkedReadIds((prev) => {
          const next = new Set(prev);
          row.conversationIds.forEach((id) => next.add(id));
          return next;
        });
      },
      onError: () => {
        autoReadCustomersRef.current.delete(stableKey);
      },
    });
  }, [viewMode, selectedCustomersRow]);

  // Clear auto-read guard only when the row has no unreads so a future unread can trigger auto-mark again.
  useEffect(() => {
    customerRows.forEach((row) => {
      if (!row.hasUnread) autoReadCustomersRef.current.delete(customerThreadRowStableKey(row));
    });
  }, [customerRows]);

  useEffect(() => {
    setSelectedCustomerRowKeys((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(Array.from(prev).filter((key) => customerRowsByKey.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [customerRowsByKey]);

  const toggleTargetIds = useMemo(() => {
    if (selectedItems.length > 0) {
      return selectedItems;
    }
    return selectedConversationId ? [selectedConversationId] : [];
  }, [selectedItems, selectedConversationId]);

  /** Customers tab: all conversation ids for mark-as-read; conversations tab uses list selection. */
  const customersMarkReadTargetIds = useMemo(
    () => (viewMode === 'customers' && selectedCustomersRow ? selectedCustomersRow.conversationIds : []),
    [viewMode, selectedCustomersRow]
  );

  /** Customers tab mark-as-unread: only the globally most recent conversation (see `latestConversationId` in useCustomerThreads). */
  const customersMarkUnreadTargetIds = useMemo((): string[] => {
    if (viewMode !== 'customers' || !selectedCustomersRow) return [];
    const mostRecentId = selectedCustomersRow.latestConversationId;
    return mostRecentId ? [mostRecentId] : [];
  }, [viewMode, selectedCustomersRow]);

  const anyToggleTargetUnread = useMemo(() => {
    if (viewMode === 'customers') {
      return selectedCustomersRow?.hasUnread ?? false;
    }
    if (!toggleTargetIds.length) return false;
    return toggleTargetIds.some((id) => {
      const conversation = conversationsById.get(id);
      return conversation ? conversation.unread_count > 0 : false;
    });
  }, [toggleTargetIds, conversationsById, viewMode, selectedCustomersRow]);

  /** Empty-state only: which channel to start (does not change sidebar list filter). */
  const handleEmptyChannelChange = (channel: 'email' | 'sms' | 'whatsapp') => {
    setEmptyChannelStartContext((prev) => (prev ? { ...prev, channel } : null));
  };

  /** Conversations tab composer: open latest conversation for that channel from the child map, or empty state + Start new conversation. */
  const handleNavigateToChannelConversation = ({
    channel,
    conversationId: targetConversationId,
  }: {
    channel: 'email' | 'sms' | 'whatsapp';
    conversationId: string | null;
  }) => {
    if (targetConversationId) {
      setSelectedConversationId(targetConversationId);
      setEmptyChannelStartContext(null);
      return;
    }
    let personId: string | null = null;
    if (selectedConversation?.person_id) {
      personId = selectedConversation.person_id;
    } else if (emptyChannelStartContext?.personId) {
      personId = emptyChannelStartContext.personId;
    }
    setSelectedConversationId(null);
    setEmptyChannelStartContext({ personId, channel });
  };

  // When the selected conversation id changes, drop the auto-read guard for the previous id; also clear the new id from
  // autoReadOnceRef so the first selection on load (prev was null) still auto-marks as read once.
  useEffect(() => {
    const prev = previousSelectedConversationIdRef.current;
    previousSelectedConversationIdRef.current = selectedConversationId;
    if (prev && prev !== selectedConversationId) {
      autoReadOnceRef.current.delete(prev);
      userForcedUnreadIds.current.delete(prev);
    }
    if (selectedConversationId) {
      autoReadOnceRef.current.delete(selectedConversationId);
    }
  }, [selectedConversationId]);

  // Auto-mark conversation as read when opened (once per visit; explicit Mark unread uses separate mutation only).
  // Uses conversationsByIdRef + markAsReadIsPendingRef + toastRef so list refetch / mutation pending toggles do not re-run this effect.
  useEffect(() => {
    if (!selectedConversationId) return;
    if (markAsReadIsPendingRef.current) return;
    const conversation = conversationsByIdRef.current.get(selectedConversationId);
    if (!conversation) return;
    if (autoReadOnceRef.current.has(conversation.id)) return;
    if (markedReadIds.has(conversation.id)) return;
    if (userForcedUnreadIds.current.has(conversation.id)) return;
    if (conversation.unread_count <= 0) return;
    if (
      conversation.channel !== 'email' &&
      conversation.channel !== 'sms' &&
      conversation.channel !== 'whatsapp'
    ) return;
    autoReadOnceRef.current.add(conversation.id);
    markAsReadMutateRef.current([conversation.id], {
      onSuccess: () => {
        setMarkedReadIds((prev) => new Set([...prev, conversation.id]));
      },
      onError: () => {
        autoReadOnceRef.current.delete(conversation.id);
        toastRef.current({
          title: 'Inbox update failed',
          variant: 'destructive',
        });
      },
    });
  }, [selectedConversationId, markedReadIds]);

  // Realtime: subscribe to inbox_messages INSERT and inbox_conversations UPDATE; debounce then fan out inbox invalidation.
  useEffect(() => {
    const channel = supabase.channel('inbox-realtime');
    const flush = () => {
      realtimeDebounceRef.current = null;
      const ids = Array.from(realtimePendingIdsRef.current);
      realtimePendingIdsRef.current.clear();
      if (ids.length === 0) return;
      void invalidateInboxData();
    };
    const scheduleFlush = () => {
      if (realtimeDebounceRef.current) return;
      realtimeDebounceRef.current = setTimeout(flush, REALTIME_DEBOUNCE_MS);
    };
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inbox_messages',
        },
        (payload: { new?: { conversation_id?: string } }) => {
          const conversationId = payload.new?.conversation_id;
          if (conversationId) {
            realtimePendingIdsRef.current.add(conversationId);
            scheduleFlush();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inbox_conversations',
        },
        (payload: { new?: { id?: string }; old?: { id?: string } }) => {
          const conversationId = payload.new?.id ?? payload.old?.id;
          if (conversationId) {
            realtimePendingIdsRef.current.add(conversationId);
            scheduleFlush();
          }
        }
      )
      .subscribe();

    return () => {
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      realtimePendingIdsRef.current.clear();
      void supabase.removeChannel(channel);
    };
  }, [invalidateInboxData]);

  // Gmail auto-sync: poll every 10s when user has an active Gmail connection.
  useEffect(() => {
    if (!gmailConnection) return;
    const tick = () => {
      const mutation = syncGmailMutationRef.current;
      if (mutation.isPending) return;
      mutation.mutate(undefined);
    };
    gmailPollIntervalRef.current = setInterval(tick, GMAIL_POLL_INTERVAL_MS);
    return () => {
      if (gmailPollIntervalRef.current) {
        clearInterval(gmailPollIntervalRef.current);
        gmailPollIntervalRef.current = null;
      }
    };
  }, [gmailConnection]);

  // Fallback refresh backbone: ensures eventual consistency if realtime misses events.
  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void invalidateInboxData();
    };
    fallbackPollIntervalRef.current = setInterval(tick, INBOX_FALLBACK_REFRESH_MS);
    return () => {
      if (fallbackPollIntervalRef.current) {
        clearInterval(fallbackPollIntervalRef.current);
        fallbackPollIntervalRef.current = null;
      }
    };
  }, [invalidateInboxData]);

  const handleToggleReadUnread = () => {
    const isMarkingRead = anyToggleTargetUnread;
    const ids: string[] =
      viewMode === 'customers'
        ? isMarkingRead
          ? customersMarkReadTargetIds
          : customersMarkUnreadTargetIds
        : toggleTargetIds;
    if (ids.length === 0) return;

    const onError = (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update read status';
      toast({
        title: 'Inbox update failed',
        description: message,
        variant: 'destructive',
      });
    };

    if (isMarkingRead) {
      ids.forEach((id) => userForcedUnreadIds.current.delete(id));
      if (viewMode === 'customers' && selectedCustomersRow) {
        userForcedUnreadIds.current.delete(customerThreadRowStableKey(selectedCustomersRow));
      }
      markAsReadMutation.mutate(ids, { onError });
    } else {
      setMarkedReadIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      ids.forEach((id) => userForcedUnreadIds.current.add(id));
      if (viewMode === 'customers' && selectedCustomersRow) {
        userForcedUnreadIds.current.add(customerThreadRowStableKey(selectedCustomersRow));
      }
      markAsUnreadMutation.mutate(ids, { onError });
    }

    if (viewMode === 'conversations' && selectedItems.length > 0) {
      setSelectedItems([]);
    }
  };

  const handleDelete = () => {
    const ids =
      selectedItems.length > 0 ? selectedItems : selectedConversationId ? [selectedConversationId] : [];
    if (ids.length === 0) return;

    const message =
      ids.length === 1
        ? 'Delete this conversation and all its messages? This cannot be undone.'
        : `Delete ${ids.length} conversations and all their messages? This cannot be undone.`;

    // Minimal confirmation UX consistent with existing app patterns.
    if (!window.confirm(message)) return;

    deleteMutation.mutate(ids, {
      onSuccess: () => {
        // If the selected conversation was deleted, clear selection and let auto-select pick next.
        if (selectedConversationId && ids.includes(selectedConversationId)) {
          setSelectedConversationId(null);
        }
        setSelectedItems([]);
      },
      onError: (error) => {
        toast({
          title: 'Delete failed',
          description: error instanceof Error ? error.message : 'Could not delete conversation(s).',
          variant: 'destructive',
        });
      },
    });
  };

  const toggleCustomerRowSelection = useCallback((key: string) => {
    setSelectedCustomerRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < MAX_BULK_DELETE_CONVERSATIONS) {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAllCustomerRows = useCallback(() => {
    const visibleKeys = customerRows.map((row) => customerThreadRowStableKey(row));
    if (visibleKeys.length === 0) return;
    const allVisibleSelected = visibleKeys.every((key) => selectedCustomerRowKeys.has(key));
    if (allVisibleSelected) {
      setSelectedCustomerRowKeys((prev) => {
        const next = new Set(prev);
        visibleKeys.forEach((key) => next.delete(key));
        return next;
      });
      return;
    }

    setSelectedCustomerRowKeys((prev) => {
      const next = new Set(prev);
      const remainingCapacity = MAX_BULK_DELETE_CONVERSATIONS - next.size;
      if (remainingCapacity <= 0) return next;
      visibleKeys
        .filter((key) => !next.has(key))
        .slice(0, remainingCapacity)
        .forEach((key) => next.add(key));
      return next;
    });
  }, [customerRows, selectedCustomerRowKeys]);

  const handleDeleteCustomersRows = useCallback(() => {
    if (selectedCustomerConversationIds.length === 0) return;
    if (selectedCustomerConversationIds.length > MAX_BULK_DELETE_CONVERSATIONS) {
      toast({
        title: 'Too many conversations selected',
        description: `Select up to ${MAX_BULK_DELETE_CONVERSATIONS} conversations in total before deleting.`,
        variant: 'destructive',
      });
      return;
    }
    setBulkDeleteConversationIds(selectedCustomerConversationIds);
    setBulkDeleteDialogOpen(true);
  }, [selectedCustomerConversationIds, toast]);

  const handleConfirmBulkDelete = useCallback(() => {
    if (bulkDeleteConversationIds.length === 0) return;
    deleteMutation.mutate(bulkDeleteConversationIds, {
      onSuccess: () => {
        if (selectedConversationId && bulkDeleteConversationIds.includes(selectedConversationId)) {
          setSelectedConversationId(null);
        }
        setSelectedItems([]);
        setSelectedCustomerRowKeys(new Set());
        setBulkDeleteDialogOpen(false);
        setBulkDeleteConversationIds([]);
        void invalidateInboxData();
      },
      onError: (error) => {
        toast({
          title: 'Delete failed',
          description: error instanceof Error ? error.message : 'Could not delete conversation(s).',
          variant: 'destructive',
        });
      },
    });
  }, [bulkDeleteConversationIds, deleteMutation, invalidateInboxData, selectedConversationId, toast]);

  const toggleSelection = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleNewConversationStart = (result: NewConversationResult) => {
    if (!organizationId) {
      toast({
        title: 'No organisation selected',
        description: 'Select an organisation before starting a conversation.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      organizationId,
      channel: result.channel,
      primary_handle: result.primary_handle,
      subject: result.subject ?? null,
      person_id: result.person_id ?? null,
    };

    const onSuccess = (data: { id: string }) => {
      setEmptyChannelStartContext(null);
      setNewConversationPrefill(null);
      if (viewMode === 'conversations') {
        setSelectedConversationId(data.id);
        setConversationsChannelFilter(result.channel === 'email' ? 'email' : 'whatsapp');
      }
    };

    const onError = (error: unknown) => {
      toast({
        title: 'Could not start conversation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    };

    if (result.channel === 'email') {
      createConversationMutation.mutate(payload, { onSuccess, onError });
      return;
    }

    if (result.channel === 'whatsapp' && result.person_id && allConversationsDisplay?.length) {
      const existing = allConversationsDisplay.find(
        (c) => c.person_id === result.person_id && c.channel === 'whatsapp'
      );
      if (existing) {
        setEmptyChannelStartContext(null);
        setNewConversationPrefill(null);
        if (viewMode === 'conversations') {
          setSelectedConversationId(existing.id);
          setConversationsChannelFilter('whatsapp');
        }
        return;
      }
    }

    createConversationMutation.mutate(payload, { onSuccess, onError });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <NewConversationModal
        open={newConversationModalOpen}
        onOpenChange={(open) => {
          setNewConversationModalOpen(open);
          if (!open) setNewConversationPrefill(null);
        }}
        onStart={handleNewConversationStart}
        initialChannel={newConversationPrefill?.initialChannel}
        initialPersonId={newConversationPrefill?.initialPersonId}
        lockChannel={!!newConversationPrefill}
      />
      <BulkDeleteConversationsDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={(open) => {
          setBulkDeleteDialogOpen(open);
          if (!open) setBulkDeleteConversationIds([]);
        }}
        count={bulkDeleteConversationIds.length}
        submitting={deleteMutation.isPending}
        onConfirm={handleConfirmBulkDelete}
      />
      {/* Three-column layout: fixed-height workspace, no page scroll */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col border border-gardens-bdr rounded-lg bg-gardens-surf2 shadow-sm">
        <div
          className={cn(
            'flex-1 min-h-0 grid gap-0 grid-cols-1 overflow-hidden lg:grid-rows-1',
            effectiveLeftCollapsed && effectiveRightCollapsed
              ? 'lg:grid-cols-[56px_minmax(0,1fr)_56px] xl:grid-cols-[56px_minmax(0,1fr)_56px]'
              : effectiveLeftCollapsed
                ? 'lg:grid-cols-[56px_minmax(0,1fr)_280px] xl:grid-cols-[56px_minmax(0,1fr)_300px]'
                : effectiveRightCollapsed
                  ? 'lg:grid-cols-[340px_minmax(0,1fr)_56px] xl:grid-cols-[360px_minmax(0,1fr)_56px]'
                  : 'lg:grid-cols-[340px_minmax(0,1fr)_280px] xl:grid-cols-[360px_minmax(0,1fr)_300px]'
          )}
        >
          {/* Column 1: Conversation list with filters and channel pills */}
          <div
            className={cn(
              "min-h-0 h-full flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-gardens-bdr bg-gardens-page/60",
              effectiveLeftCollapsed ? "p-1" : "p-2",
              // Mobile list/detail: hide the list while a conversation is selected
              isMobile && selectedConversationId && "hidden"
            )}
          >
            {/* Left panel content (kept mounted; only hidden when collapsed). */}
            <div className={cn("flex flex-col min-h-0 overflow-hidden", effectiveLeftCollapsed && "hidden")}>
              <div className="shrink-0 pb-2 flex items-center gap-1.5">
                <button
                  type="button"
                  className={cn(
                    'px-2 py-1 rounded-md text-xs font-medium border',
                    viewMode === 'conversations'
                      ? 'bg-gardens-grn-dk text-white border-gardens-grn'
                      : 'bg-white text-gardens-tx border-gardens-bdr hover:bg-gardens-page'
                  )}
                  onClick={() => setViewMode('conversations')}
                >
                  Conversations
                </button>
                <button
                  type="button"
                  className={cn(
                    'px-2 py-1 rounded-md text-xs font-medium border',
                    viewMode === 'customers'
                      ? 'bg-gardens-grn-dk text-white border-gardens-grn'
                      : 'bg-white text-gardens-tx border-gardens-bdr hover:bg-gardens-page'
                  )}
                  onClick={() => setViewMode('customers')}
                >
                  Customers
                </button>
                <button
                  type="button"
                  aria-label="Collapse conversations panel"
                  title="Collapse"
                  onClick={() => setLeftCollapsed(true)}
                  className="ml-auto p-1 rounded-md text-gardens-tx hover:bg-gardens-bdr/70 focus:outline-none"
                >
                  <PanelLeftOpen className="h-4 w-4 rotate-180" />
                </button>
              </div>
              {viewMode === 'conversations' ? (
                <InboxConversationList
                  listFilter={listFilter}
                  channelFilter={conversationsChannelFilter}
                  searchQuery={searchQuery}
                  onListFilterChange={setListFilter}
                  onChannelFilterChange={setConversationsChannelFilter}
                  onSearchChange={setSearchQuery}
                  conversations={displayConversations}
                  selectedConversationId={selectedConversationId}
                  selectedItems={selectedItems}
                  onSelectConversation={(id) => {
                    setEmptyChannelStartContext(null);
                    setSelectedConversationId(id);
                  }}
                  onToggleSelection={toggleSelection}
                  onNewClick={() => {
                    setEmptyChannelStartContext(null);
                    setNewConversationPrefill(null);
                    setNewConversationModalOpen(true);
                  }}
                  onDeleteClick={handleDelete}
                  onToggleReadUnreadClick={handleToggleReadUnread}
                  deleteDisabled={selectedItems.length === 0 && !selectedConversationId}
                  toggleReadUnreadDisabled={
                    toggleTargetIds.length === 0 ||
                    markAsReadMutation.isPending ||
                    markAsUnreadMutation.isPending
                  }
                  anyToggleTargetUnread={anyToggleTargetUnread}
                  isLoading={isLoading}
                  isError={isError}
                  hasGmailConnection={!!gmailConnection}
                  orderDisplayIdsByPersonId={orderDisplayIdsByPersonId}
                  bucketAndAgingByConversationId={bucketAndAgingByConversationId}
                  stuckCount={stuckCount}
                />
              ) : (
                <CustomerThreadList
                  listFilter={listFilter === 'stuck' ? 'all' : listFilter}
                  channelFilter={customersListChannelFilter}
                  searchQuery={searchQuery}
                  onListFilterChange={setListFilter}
                  onChannelFilterChange={setCustomersListChannelFilter}
                  onSearchChange={setSearchQuery}
                  rows={customerRows}
                  customersSelection={customersSelection}
                  onSelectCustomersRow={(row) => {
                    suppressCustomersAutoSelectRef.current = false;
                    userSelectedRef.current = true;
                    setCustomersSelection(customersSelectionFromRow(row));
                  }}
                  isLoading={customersLoading}
                  isError={customersError}
                  onToggleReadUnreadClick={handleToggleReadUnread}
                  toggleReadUnreadDisabled={
                    !selectedCustomersRow ||
                    markAsReadMutation.isPending ||
                    markAsUnreadMutation.isPending
                  }
                  selectedHasUnread={selectedCustomersRow?.hasUnread ?? false}
                  selectedRowKeys={Array.from(selectedCustomerRowKeys)}
                  onToggleRowSelection={(row) => {
                    toggleCustomerRowSelection(customerThreadRowStableKey(row));
                  }}
                  onToggleSelectAllRows={handleToggleSelectAllCustomerRows}
                  onDeleteClick={handleDeleteCustomersRows}
                />
              )}
            </div>

            {/* Left rail (desktop only). */}
            <div
              className={cn(
                "flex flex-col h-full min-h-0 items-center",
                effectiveLeftCollapsed ? "" : "hidden"
              )}
            >
              <div className="shrink-0 w-full flex justify-center pt-1">
                <button
                  type="button"
                  aria-label="Expand conversations panel"
                  title="Expand"
                  onClick={() => setLeftCollapsed(false)}
                  className="w-10 h-10 rounded-md flex items-center justify-center text-gardens-tx hover:bg-gardens-bdr/70 focus:outline-none"
                >
                  <MessageSquareText className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0" />
            </div>
          </div>

          {/* Column 2: Conversation thread + header + reply (full height; only thread scrolls; composer at bottom) */}
          <div
            className={cn(
              "flex flex-col min-h-0 h-full min-w-0 overflow-hidden bg-white",
              // Mobile list/detail: hide the thread until a conversation is chosen
              isMobile && !selectedConversationId && "hidden"
            )}
          >
            {isMobile && selectedConversationId && (
              <button
                type="button"
                onClick={() => setSelectedConversationId(null)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-gardens-bdr text-[13px] font-medium text-gardens-tx hover:bg-gardens-page"
                aria-label="Back to conversations"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            {viewMode === 'conversations' ? (
              <ConversationView
                conversationId={selectedConversationId}
                emptyChannelContext={
                  !selectedConversationId ? emptyChannelStartContext : null
                }
                onRequestNewConversation={({ channel, personId }) => {
                  setNewConversationPrefill({ initialChannel: channel, initialPersonId: personId });
                  setNewConversationModalOpen(true);
                }}
                onNavigateToChannelConversation={handleNavigateToChannelConversation}
                onEmptyChannelChange={handleEmptyChannelChange}
              />
            ) : (
              <CustomerConversationView
                customersSelection={customersSelection}
                onLinkedToPerson={(personId) => {
                  suppressCustomersAutoSelectRef.current = false;
                  userSelectedRef.current = true;
                  setCustomersSelection({ type: 'linked', personId });
                }}
                onRequestNewConversation={({ channel, personId }) => {
                  setNewConversationPrefill({ initialChannel: channel, initialPersonId: personId });
                  setNewConversationModalOpen(true);
                }}
              />
            )}
          </div>

          {/* Column 3: Order context panel */}
          <div className="hidden lg:flex lg:flex-col min-h-0 h-full min-w-0 overflow-hidden">
            {/* Expanded content (kept mounted; only hidden when collapsed). */}
            <div className={cn("flex-1 min-h-0 overflow-hidden", effectiveRightCollapsed && "hidden")}>
              <div className="relative h-full">
                {/* Collapse control for the right panel (kept outside PersonOrdersPanel). */}
                <button
                  type="button"
                  aria-label="Collapse order context panel"
                  title="Collapse"
                  onClick={() => {
                    rightManualOverride.current = true;
                    setRightCollapsed(true);
                  }}
                  className={cn(
                    "absolute top-2 left-2 z-10 w-8 h-8 rounded-md flex items-center justify-center text-gardens-tx hover:bg-gardens-bdr/70 focus:outline-none",
                    effectiveRightCollapsed && "hidden"
                  )}
                >
                  <PanelRightClose className="h-4 w-4 opacity-50" />
                </button>

                <PersonOrdersPanel
                  personId={activePersonId}
                  selectedOrderId={selectedOrderId}
                  onSelectOrder={setSelectedOrderId}
                  onCloseOrder={() => setSelectedOrderId(null)}
                  onOrdersCountChange={handleOrdersCountChange}
                />
              </div>
            </div>

            {/* Right rail (desktop only, when collapsed). */}
            <div
              className={cn(
                "w-full h-full flex flex-col items-center",
                effectiveRightCollapsed ? "" : "hidden"
              )}
            >
              <div className="shrink-0 w-full flex justify-center pt-1">
                <button
                  type="button"
                  aria-label="Expand order context panel"
                  title="Expand"
                  onClick={() => {
                    rightManualOverride.current = true;
                    setRightCollapsed(false);
                  }}
                  className="w-10 h-10 rounded-md flex items-center justify-center text-gardens-tx hover:bg-gardens-bdr/70 focus:outline-none"
                >
                  <Package className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedInboxPage;