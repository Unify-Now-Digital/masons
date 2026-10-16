import { laneStats } from '@/modules/inbox/utils/inboxRowAction';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/shared/hooks/use-toast';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useRegisterAiPanel } from '@/shared/context/aiPanel';
import { ConversationView } from "../components/ConversationView";
import { InboxConversationList, type ChannelFilter } from "../components/InboxConversationList";
import { CustomerThreadList, type CustomerListFilter } from "../components/CustomerThreadList";
import { groupWorstAging } from '../components/customerThreadListHelpers';
import { CustomerConversationView } from "../components/CustomerConversationView";
import { PersonOrdersPanel } from "../components/PersonOrdersPanel";
import { Sheet, SheetContent, SheetTitle } from "@/shared/components/ui/sheet";
import { NeedsAttentionPanel, type NeedsAttentionTarget } from "../components/NeedsAttentionPanel";
import { useMinWidth } from "../hooks/useMinWidth";
import { BellOff, ChevronLeft, Circle, EyeOff, MessageSquareText, MoreHorizontal, Package, PanelLeftOpen, Plus } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useCustomerThreads } from '../hooks/useCustomerThreads';
import { useInboxAiSweep } from '../hooks/useInboxAiSweep';
import { useInboxView } from '../hooks/useInboxView';
import { useOrdersByPersonIds } from '@/modules/orders/hooks/useOrders';
import { useCemeteries } from '@/modules/cemeteries/hooks/useCemeteryLookup';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { GhlInboxPage } from '@/modules/ghl-inbox/pages/GhlInboxPage';
import { sortCustomerRows } from '@/modules/inbox/utils/customerRowSort';
import { preparedReply, useSharedPriority, type SharedPriorityRow } from '@/shared/priority';
import { useContactDirectory } from '@/modules/inbox/hooks/useContactDirectory';
import { primeDraft } from '@/modules/inbox/utils/primedDraft';
import { PriorityList, PriorityPill, type PriorityRow } from '@/modules/inbox/components/PriorityList';
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
const SEARCH_DEBOUNCE_MS = 300;
const GMAIL_POLL_INTERVAL_MS = 120_000;
const INBOX_FALLBACK_REFRESH_MS = 60_000;

// Inbox | GHL Inbox source switch — HIDDEN behind this flag (2026-09-03, C5b).
// Why: the GHL→inbox merge is stub-only — ghlConversationSync upserts
// inbox_conversations rows and never writes inbox_messages, so the merged threads
// carry metadata and no bodies (docs/findings.md F-030). A second top-level pane
// costs a header row for a half-finished integration.
// This switch is the ONLY entry point to GhlInboxPage: /dashboard/ghl-inbox
// redirects to /dashboard/inbox (router.tsx:77) and no nav item links it. While
// this is false that page is unreachable — deliberate, not an oversight.
// Flip to true to restore the switch; no other edit is needed. If the merge is
// abandoned instead, delete together: this flag, the switch JSX, inboxSource /
// setInboxSource, the inboxSource body ternary and the GhlInboxPage import.
// Flag precedent: docs/handoff.md T7-C2/C5.
const SHOW_GHL_INBOX_TAB = false;

/** Stable reference when the query has no data yet — avoids a fresh [] each render churning displayConversations identity. */
const EMPTY_DISPLAY_CONVERSATIONS: [] = [];

function railInitials(handle: string): string {
  const s = (handle ?? '').trim();
  if (!s) return '?';
  return s.slice(0, 2).toUpperCase();
}

export const UnifiedInboxPage: React.FC = () => {
  // Spec: below 1024px the inbox is one pane (list, then thread, then the panel).
  const isWide = useMinWidth(1024);
  const { organizationId } = useOrganization();

  // Once-per-mount AI sweep (FR-019): fire-and-forget, errors to console only.
  useInboxAiSweep();

  // Single view-state model (see useInboxView): the person-grouped 'customers'
  // view is THE inbox; `?view=flat` (URL only, never persisted, no UI control)
  // is the escape hatch to the flat conversation list.
  const { view, normalizeLegacyParams } = useInboxView();

  // One-shot legacy URL normalization (strip ?segment / ?board / invalid
  // ?view=). Safe re: the ?conversation= deep link: that param is preserved
  // by the normalizer AND already consumed synchronously in the selectedConversationId
  // initializer below, which runs before any effect.
  const legacyParamsNormalizedRef = useRef(false);
  useEffect(() => {
    if (legacyParamsNormalizedRef.current) return;
    legacyParamsNormalizedRef.current = true;
    normalizeLegacyParams();
  }, [normalizeLegacyParams]);
  // Inbox source switch (UI-only): swaps the whole pane between the unified inbox
  // and the GHL inbox. NOT the backlog GHL data-merge — just folds the standalone
  // GHL Inbox page in as a top-level view. Not persisted: always lands on unified.
  const [inboxSource, setInboxSource] = useState<'unified' | 'ghl'>('unified');
  // CustomerListFilter is a superset of the Conversations tab's ListFilter
  // (adds 'customers', 'awaiting' and 'hidden'); the Conversations list coerces all three → 'all'.
  const [listFilter, setListFilter] = useState<CustomerListFilter>('inquiries');
  // Customers view: unread is an INDEPENDENT dimension, not a listFilter value — it
  // narrows whatever pill is active (All / Customers / Hidden) instead of replacing
  // it. The Conversations tab keeps its own Unread *pill*, which still rides
  // listFilter; hence the view-aware arm in baseFilters below. Not persisted and not
  // URL-addressable, same as listFilter.
  const [unreadOnly, setUnreadOnly] = useState(false);
  /** Conversations tab only: left-panel + thread navigation (which conversation to open). */
  /** Customers tab only: left-panel list filter (independent of composer send channel). */
  const [customersListChannelFilter, setCustomersListChannelFilter] = useState<ChannelFilter>('all');
  const [searchQuery, setSearchQuery] = useState("");
  /** Debounced copy feeding baseFilters (SC-005); the controlled input stays on searchQuery. */
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(() => {
    // T021: seed selection from the ?conversation=<id> deep link (e.g. from the
    // /enquiry-triage redirect) so the auto-select effect honors it when present in
    // the list, and falls back to first conversation when it isn't. Read from
    // window.location directly — searchParams (declared later) is in the TDZ here.
    const id = new URLSearchParams(window.location.search).get('conversation');
    return id && id.trim() ? id : null;
  });
  // Grouped-view counterpart of the seed above: on first load, resolve
  // ?conversation=<id> to its customer row and select that row instead of the
  // most-recent default. One-shot (cleared on first consume) so later selection
  // resets (e.g. after mark-unread) behave exactly as before.
  const customersDeepLinkConversationIdRef = useRef<string | null>(
    new URLSearchParams(window.location.search).get('conversation')?.trim() || null,
  );
  const [customersSelection, setCustomersSelection] = useState<CustomersSelection | null>(null);
  // <1024px: the list stays up until the user opens a thread. Auto-select must not flip this.
  const [narrowThreadOpen, setNarrowThreadOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  // Multi-job picker (FR-2): null = no explicit choice — consumers apply the
  // effectiveJobId default. Reset below when the conversation group changes.
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
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
  /**
   * When true, skip auto-selecting the first customer row so the thread panel stays
   * empty until the user picks a row. INERT since C3a: the only writer of `true` was
   * the removed customers mark-unread flow, so every remaining site sets it false.
   * C3c's mark-unread deliberately keeps the row selected (the userForcedUnreadIds
   * guard is what holds it unread), so it is not resurrected here. Removing the ref
   * is a separate cleanup.
   */
  const suppressCustomersAutoSelectRef = useRef(false);
  const userSelectedRef = useRef(false);
  const autoReadOnceRef = useRef<Set<string>>(new Set());
  const autoReadCustomersRef = useRef<Set<string>>(new Set());
  const previousCustomersRowKeyRef = useRef<string | null>(null);
  const realtimeEventsPendingRef = useRef(false);
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidateInFlightRef = useRef(false);

  // Desktop-only collapsible side panels:
  // - Left: conversations/customers list
  // - Right: order context panel
  // State is persisted per user via localStorage.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  // Open by default (Arin, 2026-10-14); only the user's own toggle collapses it.
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const rightManualOverride = useRef(false);

  // Avoid showing rails during the first client render before mobile/desktop is known.
  const [layoutReady, setLayoutReady] = useState(false);
  useEffect(() => {
    setLayoutReady(true);
  }, []);

  // Side order form open (reported by PersonOrdersPanel). Collapse is derived from it, never
  // set: leftCollapsed / rightCollapsed and their persistence effect are not touched by the form.
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  // Below 1280 the open form forces the list closed (transient, never persisted); at >= 1280 the
  // list stays and the conversation shrinks.
  const isXl = useMinWidth(1280);
  const orderFormForcesCollapse = orderFormOpen && !isXl;
  const effectiveLeftCollapsed = layoutReady && isWide && (leftCollapsed || orderFormForcesCollapse);
  const [rightRailEmpty, setRightRailEmpty] = useState(false);
  const effectiveRightCollapsed = layoutReady && isWide && rightCollapsed;
  // Space pass 2026-10-14: nothing to show (no linked person, no job) → slim rail,
  // so the thread gets the width instead of a 256px empty panel.
  const rightSlim = effectiveRightCollapsed || (rightRailEmpty && !orderFormOpen);
  /** Shell v2: no order/enquiry linked → the context panel is fully closed (0px). */
  const rightClosed = rightRailEmpty && !orderFormOpen;
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  // Open automatically when an order/enquiry becomes linked (a manual collapse while
  // something is linked still leaves the 48px strip so it can be reopened).
  const prevRightEmptyRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevRightEmptyRef.current === true && !rightRailEmpty) {
      rightManualOverride.current = false;
      setRightCollapsed(false);
    }
    prevRightEmptyRef.current = rightRailEmpty;
  }, [rightRailEmpty]);

  const leftStorageKey = currentUserId
    ? `inbox.desktop.leftCollapsed.v1.${currentUserId}`
    : null;
  const rightStorageKey = currentUserId
    ? `inbox.desktop.rightCollapsed.v2.${currentUserId}`
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
    if (!isWide) return;
    try {
      localStorage.setItem(leftStorageKey, String(leftCollapsed));
      localStorage.setItem(rightStorageKey, String(rightCollapsed));
    } catch {
      // Ignore persistence issues.
    }
  }, [leftStorageKey, rightStorageKey, isWide, leftCollapsed, rightCollapsed]);

  useEffect(() => {
    if (view === 'customers') {
      setEmptyChannelStartContext(null);
    }
  }, [view]);

  useEffect(() => {
    if (view !== 'customers') {
      suppressCustomersAutoSelectRef.current = false;
    }
  }, [view]);

  const { data: selectedConversation } = useConversation(selectedConversationId);
  const activePersonId = (
    view === 'customers'
      ? customersSelection?.type === 'linked'
        ? customersSelection.personId
        : null
      : selectedConversation?.person_id ?? null
  ) as string | null;

  // No auto-collapse on 0 orders (2026-10-14): enquiry / contact details are useful
  // without an order. The count callback stays wired for PersonOrdersPanel.
  const handleOrdersCountChange = useCallback((_count: number) => {}, []);

  useEffect(() => {
    rightManualOverride.current = false;
    setSelectedOrderId(null);
  }, [activePersonId]);

  // Build base API filters from list filter and search (no channel or person_id; unlinked is a filter option)
  const baseFilters = useMemo<ConversationFilters>(() => {
    const base: ConversationFilters = { status: 'open' };
    // View-aware on purpose: baseFilters feeds BOTH views (the Conversations list,
    // allConversations, and useCustomerThreads). Reading both unread sources
    // unconditionally would leak the customers icon into the Conversations fetch and
    // the Conversations Unread pill into the customers list.
    if (view === 'customers' ? unreadOnly : listFilter === 'unread') base.unread_only = true;
    if (listFilter === 'unlinked') base.unlinked_only = true;
    if (debouncedSearchQuery.trim()) base.search = debouncedSearchQuery;
    return base;
  }, [view, unreadOnly, listFilter, debouncedSearchQuery]);

  const [searchParams, setSearchParams] = useSearchParams();

  // T041: channel filter is URL-derived (source of truth), same pattern as `view`.
  // Same variable/setter names as the previous useState so all existing call sites
  // work unchanged. URLSearchParams copy composes with the view param.
  const conversationsChannelFilter: ChannelFilter =
    (['email', 'whatsapp', 'sms'] as const).find(
      (c) => c === searchParams.get('channel'),
    ) ?? 'all';
  const setConversationsChannelFilter = useCallback(
    (next: ChannelFilter) => {
      const params = new URLSearchParams(searchParams);
      if (next === 'all') params.delete('channel');
      else params.set('channel', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Conversations tab: channel filter on the conversation list + thread navigation.
  const conversationsListFilters = useMemo<ConversationFilters>(() => {
    if (conversationsChannelFilter === 'all') return baseFilters;
    return { ...baseFilters, channel: conversationsChannelFilter };
  }, [baseFilters, conversationsChannelFilter]);

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

  // --- AI panel registration (plan C3a) ------------------------------------
  // The panel owns every query it needs (C3c: the page reads none of them) — the
  // registration is title + node only.
  // `close` comes back from the registration below, but the panel element handed
  // to that registration needs the handler — so the handler reaches close via a ref.
  const closeAiPanelRef = useRef<() => void>(() => {});
  // Same reason the handler reads the view through a ref: the host captures the
  // panel node at open time, so the handler must close over nothing that can go
  // stale under it — setState and refs only.
  const aiPanelViewRef = useRef(view);
  aiPanelViewRef.current = view;
  // A customer opened from the AI panel may sit outside the loaded/filtered list
  // (db-max-rows keeps the newest 1000 open rows; filters drop more). The thread
  // view loads from the selection alone, so the selection is set directly and
  // pinned: the auto-select effect keeps it even when no row matches. Cleared by
  // any list-driven selection.
  const aiPinnedSelectionRef = useRef<{ selection: CustomersSelection; conversationId: string } | null>(null);

  const handleAiPanelSelect = useCallback((target: NeedsAttentionTarget) => {
    if (aiPanelViewRef.current === 'customers') {
      const selection: CustomersSelection = target.personId
        ? { type: 'linked', personId: target.personId }
        : { type: 'unlinked', channel: target.channel, handle: target.handle };
      aiPinnedSelectionRef.current = { selection, conversationId: target.conversationId };
      suppressCustomersAutoSelectRef.current = false;
      setCustomersSelection(selection);
    } else {
      // Flat view (?view=flat) keeps the id path; an off-list id still falls back
      // there (backlog).
      setSelectedConversationId(target.conversationId);
    }
    closeAiPanelRef.current();
  }, []);

  const { close: closeAiPanel } = useRegisterAiPanel({
    title: 'Needs attention',
    panel: <NeedsAttentionPanel onSelect={handleAiPanelSelect} />,
  });
  closeAiPanelRef.current = closeAiPanel;

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
        // Broad on purpose: covers the open thread's byConversation query (only mounted queries
        // actively refetch, so this costs one request). Do not narrow to per-conversation keys.
        await queryClient.invalidateQueries({ queryKey: inboxKeys.messages.all });
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

  // After Gmail OAuth callback: show toast and clear ?gmail=connected / ?error=<code> from URL
  useEffect(() => {
    if (searchParams.get('gmail') === 'connected') {
      queryClient.invalidateQueries({ queryKey: gmailConnectionKeys.all });
      toast({ title: 'Gmail connected', description: 'Email will sync from now onward.' });
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('gmail');
        return next;
      }, { replace: true });
      return;
    }
    const oauthError = searchParams.get('error');
    if (oauthError) {
      toast({
        title: 'Gmail connect failed',
        description:
          oauthError === 'forbidden'
            ? 'Admin access required to connect Gmail.'
            : oauthError === 'invalid_state'
              ? 'The connect link expired — please try again from Settings.'
              : `Could not complete the Gmail connection (${oauthError}). Please try again.`,
        variant: 'destructive',
      });
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('error');
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

  // Customers tab rows. Declared AFTER the bucket/aging block on purpose: the
  // grouped 'stuck' filter needs bucketAndAgingByConversationId as an input.
  const {
    rows: unsortedCustomerRows,
    isLoading: customersLoading,
    isError: customersError,
  } = useCustomerThreads({
    baseFilters,
    channelFilter: customersListChannelFilter,
    // Grouped view no longer offers Urgent/Stuck pills; coerce a carried-over
    // flat-view selection to 'all' so the list and pills stay in sync.
    listFilter: listFilter === 'urgent' || listFilter === 'stuck' ? 'all' : listFilter,
    bucketAndAgingByConversationId,
  });
  // inbox-v13 lane cards: same filters, lane-scoped (React Query dedupes the fetches).
  const { rows: laneCustomerRows } = useCustomerThreads({
    baseFilters,
    channelFilter: customersListChannelFilter,
    listFilter: 'customers',
    bucketAndAgingByConversationId,
  });
  const { rows: laneEnquiryRows } = useCustomerThreads({
    baseFilters,
    channelFilter: customersListChannelFilter,
    listFilter: 'inquiries',
    bucketAndAgingByConversationId,
  });
  const laneStatsValue = useMemo(
    () => ({
      customers: laneStats(laneCustomerRows, bucketAndAgingByConversationId),
      enquiries: laneStats(laneEnquiryRows, bucketAndAgingByConversationId, { ballWithUsOnly: true }),
    }),
    [laneCustomerRows, laneEnquiryRows, bucketAndAgingByConversationId],
  );
  // Chased first, then longest wait — sorted here so auto-select picks the top visible row.
  const customerRows = useMemo(
    () => sortCustomerRows(unsortedCustomerRows, bucketAndAgingByConversationId),
    [unsortedCustomerRows, bucketAndAgingByConversationId],
  );

  const selectedCustomersRow = useMemo(() => {
    if (!customersSelection) return null;
    return (
      [...customerRows, ...laneCustomerRows, ...laneEnquiryRows].find((r) =>
        customersSelectionsEqual(customersSelectionFromRow(r), customersSelection)
      ) ?? null
    );
  }, [customerRows, laneCustomerRows, laneEnquiryRows, customersSelection]);

  // ---- Priority mode (default): ranked top 15 per lane. Read-only; drafts never auto-send.
  const [priorityOn, setPriorityOn] = useState(true);
  const [priorityDone, setPriorityDone] = useState<Set<string>>(() => new Set());
  const [prioritySelKey, setPrioritySelKey] = useState<string | null>(null);
  const priorityScope: 'customers' | 'enquiries' = listFilter === 'customers' ? 'customers' : 'enquiries';
  const threadRowByPerson = useMemo(() => {
    const m = new Map<string, (typeof laneCustomerRows)[number]>();
    for (const r of [...laneEnquiryRows, ...laneCustomerRows]) if (r.kind === 'linked') m.set(r.personId, r);
    return m;
  }, [laneCustomerRows, laneEnquiryRows]);
  // THE shared lists (src/shared/priority) — the Hub's Sales / CS lanes render the same rows.
  const shared = useSharedPriority();
  const { titleFor } = useContactDirectory();
  const withThread = useCallback((r: SharedPriorityRow): PriorityRow => ({
    ...r,
    name: titleFor(r.name),
    conversationId: r.conversationId ?? threadRowByPerson.get(r.personId)?.latestConversationId ?? null,
  }), [threadRowByPerson, titleFor]);
  const enquiryPriority = useMemo(() => shared.enquiries.map(withThread), [shared.enquiries, withThread]);
  const customerPriority = useMemo(() => shared.customers.map(withThread), [shared.customers, withThread]);
  const priorityRows = priorityScope === 'customers' ? customerPriority : enquiryPriority;
  const prioritySel = priorityRows.find((r) => r.key === prioritySelKey) ?? null;
  const selectPriority = useCallback((r: PriorityRow, source: 'user' | 'auto' = 'auto') => {
    setPrioritySelKey(r.key);
    const selection: CustomersSelection = { type: 'linked', personId: r.personId };
    if (r.conversationId) aiPinnedSelectionRef.current = { selection, conversationId: r.conversationId };
    primeDraft(r.conversationId, preparedReply(r.name.split(' ')[0], r.action.label, r.why, r.value));
    suppressCustomersAutoSelectRef.current = false;
    userSelectedRef.current = true;
    setCustomersSelection(selection);
    if (source === 'user') setNarrowThreadOpen(true);
  }, []);
  // Auto-open the top row when entering a priority scope.
  useEffect(() => {
    if (!priorityOn || priorityRows.length === 0) return;
    if (!priorityRows.some((r) => r.key === prioritySelKey)) selectPriority(priorityRows[0]);
  }, [priorityOn, priorityRows, prioritySelKey, selectPriority]);
  const priorityDoneNext = useCallback(() => {
    if (!prioritySel) return;
    setPriorityDone((prev) => new Set(prev).add(prioritySel.key));
    const idx = priorityRows.findIndex((r) => r.key === prioritySel.key);
    const next = priorityRows.slice(idx + 1).find((r) => !priorityDone.has(r.key)) ?? priorityRows.find((r) => r.key !== prioritySel.key && !priorityDone.has(r.key));
    if (next) selectPriority(next);
  }, [prioritySel, priorityRows, priorityDone, selectPriority]);

  // Conversations behind the current selection, for the order-context panel's job probe
  // (flat: the selected conversation; grouped: all of the selected row's conversations).
  const activeConversationIds = useMemo<string[]>(() => {
    if (view === 'customers') return selectedCustomersRow?.conversationIds ?? [];
    return selectedConversationId ? [selectedConversationId] : [];
  }, [view, selectedCustomersRow, selectedConversationId]);

  // Job selection resets with the conversation group; a job switch also clears
  // the selected order (it may belong to the previous job).
  const activeConversationIdsKey = activeConversationIds.join(',');
  useEffect(() => {
    setSelectedJobId(null);
  }, [activeConversationIdsKey]);
  useEffect(() => {
    setSelectedOrderId(null);
  }, [selectedJobId]);

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
    if (view === 'customers') return;
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
  }, [displayConversations, isLoading, isError, selectedConversationId, view, emptyChannelStartContext]);

  useEffect(() => {
    if (view !== 'customers') return;
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
      const deepLinkId = customersDeepLinkConversationIdRef.current;
      if (deepLinkId) {
        customersDeepLinkConversationIdRef.current = null;
        const target = customerRows.find((row) => row.conversationIds.includes(deepLinkId));
        if (target) {
          setCustomersSelection(customersSelectionFromRow(target));
          return;
        }
      }
      setCustomersSelection(customersSelectionFromRow(customerRows[0]));
      return;
    }
    if (customersSelectionsEqual(customersSelection, aiPinnedSelectionRef.current?.selection ?? null)) {
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
  }, [view, customerRows, customersSelection, customersLoading, customersError]);

  // Customers mode: auto-mark all conversations for selected row as read on open (skipped if user marked unread for this row).
  // Uses markAsReadMutateRef + markAsReadIsPendingRef so useMarkAsRead() result identity does not retrigger this effect every render.
  useEffect(() => {
    if (view !== 'customers') return;
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
    // isPending: the early return above skips a row opened while another mark is in flight;
    // re-run when it settles so that row is still marked.
  }, [view, selectedCustomersRow, markAsReadMutation.isPending]);

  // Clear auto-read guard only when the row has no unreads so a future unread can trigger auto-mark again.
  useEffect(() => {
    customerRows.forEach((row) => {
      if (!row.hasUnread) autoReadCustomersRef.current.delete(customerThreadRowStableKey(row));
    });
  }, [customerRows]);

  // Drop the manual-unread guard when the selection leaves the row, mirroring the
  // Conversations-tab cleanup for conversation ids. Without it a row marked unread
  // stays guarded for the session and never auto-reads again. Returning to the row
  // auto-reads it, which is what reopening an unread thread means. Declared AFTER the
  // auto-read effect so effect order is: auto-read the new row, then clean up the old.
  useEffect(() => {
    const key = selectedCustomersRow ? customerThreadRowStableKey(selectedCustomersRow) : null;
    const prev = previousCustomersRowKeyRef.current;
    previousCustomersRowKeyRef.current = key;
    if (prev && prev !== key) userForcedUnreadIds.current.delete(prev);
  }, [selectedCustomersRow]);

  const toggleTargetIds = useMemo(() => {
    if (selectedItems.length > 0) {
      return selectedItems;
    }
    return selectedConversationId ? [selectedConversationId] : [];
  }, [selectedItems, selectedConversationId]);

  const anyToggleTargetUnread = useMemo(() => {
    if (!toggleTargetIds.length) return false;
    return toggleTargetIds.some((id) => {
      const conversation = conversationsById.get(id);
      return conversation ? conversation.unread_count > 0 : false;
    });
  }, [toggleTargetIds, conversationsById]);

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
      if (!realtimeEventsPendingRef.current) return;
      realtimeEventsPendingRef.current = false;
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
          if (payload.new?.conversation_id) {
            realtimeEventsPendingRef.current = true;
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
          if (payload.new?.id ?? payload.old?.id) {
            realtimeEventsPendingRef.current = true;
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
      realtimeEventsPendingRef.current = false;
      void supabase.removeChannel(channel);
    };
  }, [invalidateInboxData]);

  // Gmail auto-sync when the org has an ACTIVE connection. The mutation passes a
  // `since` cursor (sessionStorage, else two hours) so a stalled last_synced_at
  // cannot reopen a 30-day window. Never poll a revoked connection.
  useEffect(() => {
    if (gmailConnection?.status !== 'active') return;
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
    const ids: string[] = toggleTargetIds;
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
      markAsReadMutation.mutate(ids, { onError });
    } else {
      setMarkedReadIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      ids.forEach((id) => userForcedUnreadIds.current.add(id));
      markAsUnreadMutation.mutate(ids, { onError });
    }

    if (view !== 'customers' && selectedItems.length > 0) {
      setSelectedItems([]);
    }
  };

  /**
   * Customers view: mark the selected row unread (C3c — restores the capability R-001
   * removed at C3a; bulk read/unread stays gone). Mark-unread ONLY: the customers
   * auto-read effect reads the selected row on open, so a "mark read" half would be a
   * no-op by construction. Targets the row's LATEST conversation only — one unread is
   * enough to make the row read as unread, and marking every member would be the bulk
   * action this feature removed.
   *
   * TRAP — `userForcedUnreadIds` is ONE Set holding TWO key spaces: the customers
   * auto-read effect tests a ROW STABLE KEY, while handleToggleReadUnread (Conversations
   * tab) stores CONVERSATION IDS. The two have not intersected since C3a. Writing a
   * conversation id here would leave the auto-read effect unguarded, and it would
   * silently re-read the row.
   */
  const handleMarkCustomersRowUnread = () => {
    const row = selectedCustomersRow;
    if (!row) return;
    const targetId = row.latestConversationId;
    if (!targetId) return;

    setMarkedReadIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });

    const stableKey = customerThreadRowStableKey(row);
    userForcedUnreadIds.current.add(stableKey);
    // Drop the once-guard too: it is cleared as soon as a row reads clean, so leaving
    // it set would block the auto-read that should follow a later revisit.
    autoReadCustomersRef.current.delete(stableKey);

    markAsUnreadMutation.mutate([targetId], {
      onError: (error: unknown) => {
        userForcedUnreadIds.current.delete(stableKey);
        toast({
          title: 'Inbox update failed',
          description: error instanceof Error ? error.message : 'Failed to update read status',
          variant: 'destructive',
        });
      },
    });
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
      if (view !== 'customers') {
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
        if (view !== 'customers') {
          setSelectedConversationId(existing.id);
          setConversationsChannelFilter('whatsapp');
        }
        return;
      }
    }

    createConversationMutation.mutate(payload, { onSuccess, onError });
  };

  // C6: the customers-view icon cluster and the list-collapse button are defined here —
  // every handler closes over page state — and travel into CustomerThreadList's pill row
  // as the `headerActions` slot, so pills + channel + icons render on one line.
  // Collapse is a SEPARATE const because it is the one control the flat view also needs:
  // ?view=flat keeps its own New and Read/Unread controls inside InboxConversationList,
  // so the four customers-only icons must not reach it, but Collapse must.
  const iconBtn = "inline-flex h-11 w-11 items-center justify-center rounded-md focus:outline-none lg:h-8 lg:w-8";
  const collapseListButton = (
    <button
      type="button"
      aria-label="Collapse conversations panel"
      title="Collapse"
      onClick={() => { if (!orderFormForcesCollapse) setLeftCollapsed(true); }}
      className={cn(iconBtn, "hidden text-gardens-tx hover:bg-gardens-bdr/70 lg:inline-flex")}
    >
      <PanelLeftOpen className="h-4 w-4 rotate-180" />
    </button>
  );

  // The old `view === 'customers' &&` gate is DROPPED, not lost: this fragment now reaches
  // the DOM only through CustomerThreadList, which renders only in the customers branch,
  // so the gate became structurally redundant. The flat view still cannot see these four.
  const mobileOrderButton = () => (
    <button
      type="button"
      onClick={() => setMobileSheetOpen(true)}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-gardens-bdr bg-gardens-surf px-2 text-[12px] font-semibold text-gardens-tx"
      aria-label="Open order context"
      data-testid="inbox-right-sheet-trigger"
    >
      <Package className="h-3.5 w-3.5" aria-hidden />
      Order
    </button>
  );
  const threadChrome = !isWide && narrowThreadOpen
    ? {
        leading: (
          <button
            type="button"
            onClick={() => {
              setNarrowThreadOpen(false);
              if (view !== 'customers') setSelectedConversationId(null);
            }}
            className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md pr-1 text-[13px] font-medium text-gardens-tx hover:bg-gardens-page"
            aria-label="Back to conversations"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ),
        orderSlot: mobileOrderButton(),
      }
    : null;
  const customersListHeaderActions = (
    <>
      {!isWide && !narrowThreadOpen && mobileOrderButton()}
      <button
        type="button"
        aria-label="Unread only"
        aria-pressed={unreadOnly}
        title="Unread only"
        onClick={() => setUnreadOnly((v) => !v)}
        className={iconBtn}
        style={{
          // Selected-toggle pairing per PipelinePage.tsx:100-102 (R-003), same
          // idiom as InvoiceWorkspace.tsx:660-676. Transparent border when off
          // so pressing causes no size shift.
          background: unreadOnly ? 'var(--g-acc-lt)' : 'transparent',
          border: `1px solid ${unreadOnly ? 'var(--g-acc)' : 'transparent'}`,
          color: unreadOnly ? 'var(--g-acc-dk)' : 'var(--g-tx)',
        }}
      >
        <Circle className="h-3.5 w-3.5 fill-current" />
      </button>
      <button
        type="button"
        aria-label="Hidden senders"
        aria-pressed={listFilter === 'hidden'}
        title="Hidden senders"
        onClick={() => setListFilter(listFilter === 'hidden' ? 'all' : 'hidden')}
        className={iconBtn}
        style={{
          // Same pairing as the Unread toggle above. Unlike unreadOnly this is NOT an
          // independent dimension: 'hidden' is a listFilter value and the hook makes it
          // exclusive (useCustomerThreads:140-144 — 'hidden' shows only muted groups,
          // every other filter excludes them), so off returns to 'all', and no pill in
          // the row reads as selected while it is on. The icon carries the state.
          background: listFilter === 'hidden' ? 'var(--g-acc-lt)' : 'transparent',
          border: `1px solid ${listFilter === 'hidden' ? 'var(--g-acc)' : 'transparent'}`,
          color: listFilter === 'hidden' ? 'var(--g-acc-dk)' : 'var(--g-tx)',
        }}
      >
        <BellOff className="h-3.5 w-3.5" />
      </button>
      {/* Mark unread + New folded into ⋯ so All/Customers/Inquiries cycling pill stays visible. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More list actions"
          title="More"
          className={cn(iconBtn, "text-gardens-tx hover:bg-gardens-bdr/70 focus:ring-2 focus:ring-gardens-grn/30")}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!selectedCustomersRow || markAsUnreadMutation.isPending}
            onSelect={() => handleMarkCustomersRowUnread()}
            className="gap-2"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Mark unread
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setEmptyChannelStartContext(null);
              setNewConversationPrefill(null);
              setNewConversationModalOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            New conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {collapseListButton}
    </>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-0.5 min-[1440px]:pt-1">
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
      {/* Inbox source switch: Inbox | GHL Inbox — top-level, swaps the whole pane.
          Hidden while SHOW_GHL_INBOX_TAB is false (see the flag above). */}
      {SHOW_GHL_INBOX_TAB && (
        <div className="shrink-0 px-1 pt-1 pb-3 flex items-center gap-2" role="tablist" aria-label="Inbox source">
          <button
            type="button"
            role="tab"
            aria-selected={inboxSource === 'unified'}
            className={cn(
              'px-2 py-1 rounded-md text-xs font-medium border',
              inboxSource === 'unified'
                ? 'bg-gardens-grn-dk text-white border-gardens-grn'
                : 'bg-white text-gardens-tx border-gardens-bdr hover:bg-gardens-page'
            )}
            onClick={() => setInboxSource('unified')}
          >
            Inbox
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={inboxSource === 'ghl'}
            className={cn(
              'px-2 py-1 rounded-md text-xs font-medium border',
              inboxSource === 'ghl'
                ? 'bg-gardens-grn-dk text-white border-gardens-grn'
                : 'bg-white text-gardens-tx border-gardens-bdr hover:bg-gardens-page'
            )}
            onClick={() => setInboxSource('ghl')}
          >
            GHL Inbox
          </button>
        </div>
      )}
      {/* Body: GHL source swaps the whole three-column workspace */}
      {inboxSource === 'ghl' ? (
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
          <GhlInboxPage />
        </div>
      ) : (
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col border border-gardens-bdr rounded-lg bg-gardens-surf2 shadow-sm">
        <div
          className={cn(
            'flex-1 min-h-0 grid gap-0 grid-cols-1 grid-rows-1 overflow-hidden',
            // Shell v2: nothing linked → right column is 0px (fully closed, no 48px strip).
            orderFormOpen
              ? effectiveLeftCollapsed
                ? 'lg:grid-cols-[56px_minmax(0,1fr)_440px]'
                : 'lg:grid-cols-[288px_minmax(0,1fr)_400px] min-[1440px]:grid-cols-[360px_minmax(0,1fr)_440px]'
              : rightClosed
                ? effectiveLeftCollapsed
                  ? 'lg:grid-cols-[48px_minmax(0,1fr)_0px] min-[1440px]:grid-cols-[56px_minmax(0,1fr)_0px]'
                  : 'lg:grid-cols-[288px_minmax(0,1fr)_0px] min-[1440px]:grid-cols-[360px_minmax(0,1fr)_0px]'
              : effectiveLeftCollapsed && rightSlim
              ? 'lg:grid-cols-[48px_minmax(0,1fr)_48px] min-[1440px]:grid-cols-[56px_minmax(0,1fr)_56px]'
              : effectiveLeftCollapsed
                ? 'lg:grid-cols-[48px_minmax(0,1fr)_320px] min-[1440px]:grid-cols-[56px_minmax(0,1fr)_340px]'
                : rightSlim
                  ? 'lg:grid-cols-[288px_minmax(0,1fr)_48px] min-[1440px]:grid-cols-[360px_minmax(0,1fr)_56px]'
                  : 'lg:grid-cols-[288px_minmax(0,1fr)_320px] min-[1440px]:grid-cols-[360px_minmax(0,1fr)_340px]'
          )}
        >
          {/* Column 1: Conversation list with filters and channel pills */}
          <div
            className={cn(
              "min-h-0 h-full flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-gardens-bdr bg-gardens-page/60",
              effectiveLeftCollapsed ? "p-1" : "p-1.5 min-[1440px]:p-2",
              // Below lg: one pane. The list hides once the user opens a thread.
              !isWide && narrowThreadOpen && "hidden"
            )}
          >
            {/* Left panel content (kept mounted; only hidden when collapsed). */}
            <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", effectiveLeftCollapsed && "hidden")}>
              {/* No view switch here on purpose: grouped Customers IS the inbox; ?view=flat is the URL-only escape hatch. */}
              {/* C6: the customers view's icon row is gone — its cluster renders inside
                  CustomerThreadList's pill row (headerActions). The flat view keeps a
                  collapse-only row: it has no pill row of ours to host the button. */}
              {view !== 'customers' && (
                <div className="shrink-0 pb-2 flex items-center justify-end gap-1">
                  {collapseListButton}
                </div>
              )}
              {view !== 'customers' ? (
                <InboxConversationList
                  listFilter={
                    listFilter === 'customers' || listFilter === 'inquiries' || listFilter === 'awaiting' || listFilter === 'hidden'
                      ? 'all'
                      : listFilter
                  }
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
                    setNarrowThreadOpen(true);
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
                  hasGmailConnection={gmailConnection?.status === 'active'}
                  orderDisplayIdsByPersonId={orderDisplayIdsByPersonId}
                  bucketAndAgingByConversationId={bucketAndAgingByConversationId}
                  stuckCount={stuckCount}
                  orderButton={!isWide && !narrowThreadOpen ? mobileOrderButton() : null}
                />
              ) : (
                <CustomerThreadList
                  headerActions={customersListHeaderActions}
                  laneStats={laneStatsValue}
                  priority={{
                    on: priorityOn,
                    count: priorityRows.length,
                    onToggle: (on) => {
                      setPriorityOn(on);
                      if (on && listFilter !== 'customers' && listFilter !== 'inquiries') setListFilter('inquiries');
                    },
                    content: (
                      <PriorityList
                        rows={priorityRows}
                        selectedKey={prioritySelKey}
                        doneKeys={priorityDone}
                        onSelect={(row) => selectPriority(row, 'user')}
                        isLoading={priorityScope === 'customers' ? shared.customersLoading : shared.enquiriesLoading}
                        emptyText={priorityScope === 'customers' ? 'No open orders need you' : 'No enquiries need you today'}
                      />
                    ),
                  }}
                  listFilter={listFilter === 'urgent' || listFilter === 'stuck' ? 'all' : listFilter}
                  bucketAndAgingByConversationId={bucketAndAgingByConversationId}
                  channelFilter={customersListChannelFilter}
                  searchQuery={searchQuery}
                  onListFilterChange={setListFilter}
                  onChannelFilterChange={setCustomersListChannelFilter}
                  onSearchChange={setSearchQuery}
                  rows={customerRows}
                  customersSelection={customersSelection}
                  onSelectCustomersRow={(row) => {
                    aiPinnedSelectionRef.current = null;
                    suppressCustomersAutoSelectRef.current = false;
                    userSelectedRef.current = true;
                    setCustomersSelection(customersSelectionFromRow(row));
                    setNarrowThreadOpen(true);
                  }}
                  isLoading={customersLoading}
                  isError={customersError}
                />
              )}
            </div>

            {/* Left rail (desktop only). */}
            <div
              className={cn(
                "flex flex-col flex-1 min-h-0 items-center",
                effectiveLeftCollapsed ? "" : "hidden"
              )}
            >
              <div className="shrink-0 w-full flex justify-center pt-1">
                <button
                  type="button"
                  aria-label="Expand conversations panel"
                  title="Expand"
                  onClick={() => { if (!orderFormForcesCollapse) setLeftCollapsed(false); }}
                  className="w-10 h-10 rounded-md flex items-center justify-center text-gardens-tx hover:bg-gardens-bdr/70 focus:outline-none"
                >
                  <MessageSquareText className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 w-full overflow-y-auto scrollbar-hide flex flex-col items-center gap-1.5 pt-1">
                {(() => {
                  const unread = displayConversations.reduce((n, c) => n + (c.unread_count ?? 0), 0);
                  return unread > 0 ? (
                    <span className="text-[10px] font-semibold text-white bg-gardens-grn-dk rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                      {unread}
                    </span>
                  ) : null;
                })()}
                {displayConversations.map((c) => {
                  const isSel = c.id === selectedConversationId;
                  const isUnread = (c.unread_count ?? 0) > 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-label={`Open conversation with ${titleFor(c.primary_handle)}`}
                      title={titleFor(c.primary_handle)}
                      onClick={() => { setSelectedConversationId(c.id); setNarrowThreadOpen(true); }}
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 border",
                        isSel
                          ? "bg-gardens-acc-lt border-gardens-acc text-gardens-tx"
                          : isUnread
                            ? "bg-gardens-grn-lt border-transparent text-gardens-tx"
                            : "bg-gardens-surf2 border-gardens-bdr text-gardens-txs hover:bg-gardens-page"
                      )}
                    >
                      {railInitials(c.primary_handle)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Column 2: Conversation thread + header + reply (full height; only thread scrolls; composer at bottom) */}
          <div
            className={cn(
              "flex flex-col min-h-0 h-full min-w-0 overflow-hidden bg-white",
              // Below lg the thread is a full-height pane, opened from a row.
              !isWide && !narrowThreadOpen && "hidden"
            )}
          >
            {view !== 'customers' ? (
              <ConversationView
                headerChrome={threadChrome}
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
              <>
              {isWide && priorityOn && prioritySel && (
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gardens-bdr bg-gardens-page/60 px-3 py-2" data-testid="priority-bar">
                  <span className="whitespace-nowrap text-[11px] font-semibold tabular-nums text-gardens-txs">
                    #{priorityRows.indexOf(prioritySel) + 1} of {priorityRows.length}
                  </span>
                  <PriorityPill action={prioritySel.action} solid />
                  <span className="min-w-0 flex-1 basis-48 text-[13px] leading-5 text-gardens-tx line-clamp-2" title={prioritySel.why}>{prioritySel.why}</span>
                  <button
                    type="button"
                    onClick={priorityDoneNext}
                    data-testid="priority-done-next"
                    className="h-8 shrink-0 rounded-md bg-gardens-acc px-3 text-[13px] font-semibold text-white hover:opacity-90"
                  >
                    Done → Next priority
                  </button>
                </div>
              )}
              <CustomerConversationView
                headerChrome={threadChrome}
                prioritySlot={!isWide && priorityOn && prioritySel ? (
                  <details className="shrink-0 border-b border-gardens-bdr bg-gardens-page/60" data-testid="priority-bar">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1 text-[12px] [&::-webkit-details-marker]:hidden">
                      <span className="shrink-0 font-semibold tabular-nums text-gardens-txs">
                        #{priorityRows.indexOf(prioritySel) + 1} of {priorityRows.length}
                      </span>
                      <PriorityPill action={prioritySel.action} solid compact />
                      <span className="min-w-0 flex-1 truncate text-gardens-tx" title={prioritySel.why}>{prioritySel.why}</span>
                    </summary>
                    <div className="flex justify-end px-2 pb-2">
                      <button
                        type="button"
                        onClick={priorityDoneNext}
                        data-testid="priority-done-next"
                        className="h-8 shrink-0 rounded-md bg-gardens-acc px-3 text-[13px] font-semibold text-white hover:opacity-90"
                      >
                        Done → Next priority
                      </button>
                    </div>
                  </details>
                ) : null}
                customersSelection={customersSelection}
                rowAging={selectedCustomersRow ? groupWorstAging(selectedCustomersRow, bucketAndAgingByConversationId) : null}
                fallbackName={
                  selectedCustomersRow
                    ? selectedCustomersRow.kind === 'linked'
                      ? selectedCustomersRow.displayName
                      : selectedCustomersRow.displayTitle
                    : null
                }
                unlinkedGroupConversationIds={
                  selectedCustomersRow?.kind === 'unlinked'
                    ? selectedCustomersRow.conversationIds
                    : undefined
                }
                groupConversationIds={selectedCustomersRow?.conversationIds}
                groupLatestConversationId={
                  selectedCustomersRow?.latestConversationId ??
                  aiPinnedSelectionRef.current?.conversationId
                }
                selectedJobId={selectedJobId}
                onSelectJob={setSelectedJobId}
                onLinkedToPerson={(personId) => {
                  aiPinnedSelectionRef.current = null;
                  suppressCustomersAutoSelectRef.current = false;
                  userSelectedRef.current = true;
                  setCustomersSelection({ type: 'linked', personId });
                }}
                onRequestNewConversation={({ channel, personId }) => {
                  setNewConversationPrefill({ initialChannel: channel, initialPersonId: personId });
                  setNewConversationModalOpen(true);
                }}
              />
              </>
            )}
          </div>

          {/* Column 3: Order context panel (0px and hidden when nothing is linked) */}
          <div className={cn("hidden min-h-0 h-full min-w-0 overflow-hidden", rightClosed ? "lg:hidden" : "lg:flex lg:flex-col")} data-testid="inbox-right-panel" data-state={rightClosed ? "closed" : rightSlim ? "slim" : "open"}>
            {/* Expanded content (kept mounted; only hidden when collapsed). */}
            <div className={cn("flex-1 min-h-0 overflow-hidden", rightSlim && "hidden")}>
              <div className="relative h-full">
                <PersonOrdersPanel
                  personId={activePersonId}
                  conversationIds={activeConversationIds}
                  selectedJobId={selectedJobId}
                  selectedOrderId={selectedOrderId}
                  onSelectOrder={setSelectedOrderId}
                  onCloseOrder={() => {
                    setSelectedOrderId(null);
                    rightManualOverride.current = true;
                    setRightCollapsed(true);
                  }}
                  onOrdersCountChange={handleOrdersCountChange}
                  onOrderFormOpenChange={setOrderFormOpen}
                  onEmptyChange={setRightRailEmpty}
                />
              </div>
            </div>

            {/* Right rail (desktop only, when collapsed). */}
            <div
              className={cn(
                "w-full h-full flex flex-col items-center",
                rightSlim ? "" : "hidden"
              )}
            >
              <div className="shrink-0 w-full flex justify-center pt-1">
                <button
                  type="button"
                  aria-label={effectiveRightCollapsed ? "Expand order context panel" : "Order context: link a customer to see orders"}
                  title={effectiveRightCollapsed ? "Expand" : "Order context appears when a linked customer is selected"}
                  disabled={!effectiveRightCollapsed}
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
      )}

      {/* Shell v2 mobile/tablet (<1024px): the order context is a bottom sheet, opened
          from a small pill only when an order/enquiry is linked. */}
      {inboxSource !== 'ghl' && (
        <>
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetContent side="bottom" className="h-[80vh] overflow-hidden rounded-t-2xl bg-gardens-surf2 p-0 lg:hidden [&>button]:h-11 [&>button]:w-11">
              <SheetTitle className="sr-only">Order context</SheetTitle>
              {mobileSheetOpen && (
                <PersonOrdersPanel
                  personId={activePersonId}
                  conversationIds={activeConversationIds}
                  selectedJobId={selectedJobId}
                  selectedOrderId={selectedOrderId}
                  onSelectOrder={setSelectedOrderId}
                  onCloseOrder={() => setSelectedOrderId(null)}
                />
              )}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
};

export default UnifiedInboxPage;
