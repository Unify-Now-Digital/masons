import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/shared/hooks/use-toast';
import { supabase } from '@/shared/lib/supabase';
import { ConversationView } from "../components/ConversationView";
import { InboxConversationList, type ListFilter, type ChannelFilter } from "../components/InboxConversationList";
import { CustomerThreadList } from "../components/CustomerThreadList";
import { CustomerConversationView } from "../components/CustomerConversationView";
import { PersonOrdersPanel } from "../components/PersonOrdersPanel";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useOrganization } from '@/shared/context/OrganizationContext';
import { MessageSquareText, Package, PanelLeftOpen, PanelRightClose } from "lucide-react";
import {
  inboxKeys,
  useConversationsList,
  useCreateConversation,
  useMarkAsRead,
  useMarkAsUnread,
  useDeleteConversations,
  useSyncGmail,
} from "@/modules/inbox/hooks/useInboxConversations";
import { NewConversationModal, type NewConversationResult } from "@/modules/inbox/components/NewConversationModal";
import { BulkDeleteConversationsDialog } from '@/modules/inbox/components/BulkDeleteConversationsDialog';
import { useGmailConnection } from "@/modules/inbox/hooks/useGmailConnection";
import { gmailConnectionKeys } from "@/modules/inbox/hooks/useGmailConnection";
import type { ConversationFilters, CustomersSelection, CustomerThreadRow } from "@/modules/inbox/types/inbox.types";
import {
  customersSelectionsEqual,
  customersSelectionFromRow,
  customerThreadRowStableKey,
} from "@/modules/inbox/types/inbox.types";
import { cn } from "@/shared/lib/utils";
import { useCustomerThreads } from '../hooks/useCustomerThreads';
import { invalidateInboxThreadSummaries } from '@/modules/inbox/hooks/useThreadSummary';

const REALTIME_DEBOUNCE_MS = 200;
const GMAIL_POLL_INTERVAL_MS = 10_000;
const INBOX_FALLBACK_REFRESH_MS = 20_000;
const MAX_BULK_DELETE = 50;
const MAX_CUSTOMER_ROWS_SELECTION = 50;

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
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [customersSelection, setCustomersSelection] = useState<CustomersSelection | null>(null);
  const [selectedCustomerRowKeys, setSelectedCustomerRowKeys] = useState<string[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [newConversationModalOpen, setNewConversationModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleteDialogTitle, setDeleteDialogTitle] = useState<string | null>(null);
  const [deleteContext, setDeleteContext] = useState<'conversations' | 'customers'>('conversations');
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

  const handleOrdersCountChange = useCallback((count: number) => {
    if (!rightManualOverride.current) {
      setRightCollapsed(count === 0);
    }
  }, []);

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
    listFilter,
  });

  const selectedCustomersRow = useMemo(() => {
    if (!customersSelection) return null;
    return (
      customerRows.find((r) =>
        customersSelectionsEqual(customersSelectionFromRow(r), customersSelection)
      ) ?? null
    );
  }, [customerRows, customersSelection]);

  const selectedCustomerRows = useMemo(() => {
    if (selectedCustomerRowKeys.length === 0) return [];
    const keySet = new Set(selectedCustomerRowKeys);
    return customerRows.filter((row) => keySet.has(customerThreadRowStableKey(row)));
  }, [customerRows, selectedCustomerRowKeys]);

  const selectedCustomerConversationIds = useMemo(() => {
    const ids = new Set<string>();
    selectedCustomerRows.forEach((row) => {
      row.conversationIds.forEach((id) => ids.add(id));
    });
    return Array.from(ids);
  }, [selectedCustomerRows]);

  useEffect(() => {
    if (selectedCustomerRowKeys.length === 0) return;
    const existingKeys = new Set(customerRows.map((row) => customerThreadRowStableKey(row)));
    setSelectedCustomerRowKeys((prev) => prev.filter((key) => existingKeys.has(key)));
  }, [customerRows, selectedCustomerRowKeys.length]);

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
        await queryClient.invalidateQueries({ queryKey: inboxKeys.all });
        invalidateInboxThreadSummaries(queryClient);
      } finally {
        invalidateInFlightRef.current = false;
      }
    },
    [queryClient]
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

  const selectedConversationFromList = selectedConversationId
    ? conversationsById.get(selectedConversationId) ?? null
    : null;

  const activePersonId = (
    viewMode === 'customers'
      ? customersSelection?.type === 'linked'
        ? customersSelection.personId
        : null
      : selectedConversationFromList?.person_id ?? null
  ) as string | null;

  useEffect(() => {
    rightManualOverride.current = false;
    setSelectedOrderId(null);
  }, [activePersonId]);

  // Client-side Urgent filter (no backend field): filter by subject/preview containing "urgent".
  // When not urgent, return `conversations` as-is so referential identity matches React Query (stable across polls if data unchanged).
  const displayConversations = useMemo(() => {
    if (!conversationsWithDisplayUnread) return EMPTY_DISPLAY_CONVERSATIONS;
    if (listFilter !== 'urgent') return conversationsWithDisplayUnread;
    return conversationsWithDisplayUnread.filter(
      (c) =>
        /urgent/i.test(c.subject ?? '') ||
        /urgent/i.test(c.last_message_preview ?? '')
    );
  }, [conversationsWithDisplayUnread, listFilter]);

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
    if (viewMode !== 'customers') return;
    if (customersLoading || customersError) return;
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
    if (selectedConversationFromList?.person_id) {
      personId = selectedConversationFromList.person_id;
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
    if (ids.length > MAX_BULK_DELETE) {
      toast({
        title: 'Selection limit reached',
        description: `You can delete up to ${MAX_BULK_DELETE} conversations at once.`,
        variant: 'destructive',
      });
      return;
    }
    setDeleteTargetIds(ids);
    setDeleteDialogTitle(null);
    setDeleteContext('conversations');
    setDeleteDialogOpen(true);
  };

  const customersDeleteLabel = useMemo(() => {
    if (selectedCustomerRowKeys.length === 0) return 'Delete';
    return `Delete (${selectedCustomerRowKeys.length})`;
  }, [selectedCustomerRowKeys.length]);

  const allCustomerRowsSelected =
    customerRows.length > 0 &&
    selectedCustomerRows.length === Math.min(customerRows.length, MAX_CUSTOMER_ROWS_SELECTION);

  const handleDeleteCustomersRow = () => {
    const ids = selectedCustomerConversationIds;
    if (ids.length === 0) return;

    const title =
      selectedCustomerRows.length === 1 && selectedCustomerRows[0].kind === 'linked'
        ? `Delete all conversations for ${selectedCustomerRows[0].displayName}? This cannot be undone.`
        : `Delete ${ids.length} conversations? This cannot be undone.`;

    setDeleteTargetIds(ids);
    setDeleteDialogTitle(title);
    setDeleteContext('customers');
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetIds.length === 0) return;
    if (deleteContext === 'conversations' && deleteTargetIds.length > MAX_BULK_DELETE) {
      toast({
        title: 'Selection limit reached',
        description: `You can delete up to ${MAX_BULK_DELETE} conversations at once.`,
        variant: 'destructive',
      });
      return;
    }
    deleteMutation.mutate(deleteTargetIds, {
      onSuccess: () => {
        // If the selected conversation was deleted, clear selection and let auto-select pick next.
        if (selectedConversationId && deleteTargetIds.includes(selectedConversationId)) {
          setSelectedConversationId(null);
        }
        setSelectedItems([]);
        if (deleteContext === 'customers') {
          suppressCustomersAutoSelectRef.current = true;
          setSelectedCustomerRowKeys([]);
          setCustomersSelection(null);
        }
        setDeleteDialogOpen(false);
        setDeleteTargetIds([]);
        setDeleteDialogTitle(null);
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
    setSelectedItems(prev => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= MAX_BULK_DELETE) {
        toast({
          title: 'Selection limit reached',
          description: `You can select up to ${MAX_BULK_DELETE} conversations.`,
          variant: 'destructive',
        });
        return prev;
      }
      return [...prev, id];
    });
  };

  const toggleCustomerRowSelection = (row: CustomerThreadRow) => {
    const key = customerThreadRowStableKey(row);
    setSelectedCustomerRowKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_CUSTOMER_ROWS_SELECTION) {
        toast({
          title: 'Selection limit reached',
          description: `You can select up to ${MAX_CUSTOMER_ROWS_SELECTION} customer rows.`,
          variant: 'destructive',
        });
        return prev;
      }
      return [...prev, key];
    });
  };

  const toggleSelectAllCustomerRows = () => {
    const selectableRowsCount = Math.min(customerRows.length, MAX_CUSTOMER_ROWS_SELECTION);
    if (selectedCustomerRows.length === selectableRowsCount && selectableRowsCount > 0) {
      setSelectedCustomerRowKeys([]);
      return;
    }
    const keys = customerRows
      .slice(0, MAX_CUSTOMER_ROWS_SELECTION)
      .map((row) => customerThreadRowStableKey(row));
    setSelectedCustomerRowKeys(keys);
  };

  const handleNewConversationStart = (result: NewConversationResult) => {
    if (!organizationId) {
      toast({
        title: 'Could not start conversation',
        description: 'No active organisation selected.',
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
      <BulkDeleteConversationsDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !deleteMutation.isPending) {
            setDeleteTargetIds([]);
            setDeleteDialogTitle(null);
            setDeleteContext('conversations');
          }
        }}
        count={deleteTargetIds.length}
        title={deleteDialogTitle ?? undefined}
        submitting={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
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
      {/* Three-column layout: fixed-height workspace, no page scroll */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col border border-gardens-bdr rounded-lg bg-gardens-surf2 shadow-sm">
        <div
          className={cn(
            'flex-1 min-h-0 grid grid-rows-1 gap-0 grid-cols-1 overflow-hidden',
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
              "min-h-0 h-full flex flex-col overflow-hidden border-r border-slate-200 bg-slate-100/60",
              effectiveLeftCollapsed ? "p-1" : "p-2"
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
                      ? 'bg-gardens-acc text-white border-gardens-acc'
                      : 'bg-gardens-surf2 text-gardens-txs border-gardens-bdr hover:bg-gardens-page'
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
                      ? 'bg-gardens-acc text-white border-gardens-acc'
                      : 'bg-gardens-surf2 text-gardens-txs border-gardens-bdr hover:bg-gardens-page'
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
                  className="ml-auto p-1 rounded-md text-slate-600 hover:bg-slate-200/70 focus:outline-none"
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
                />
              ) : (
                <CustomerThreadList
                  listFilter={listFilter}
                  channelFilter={customersListChannelFilter}
                  searchQuery={searchQuery}
                  onListFilterChange={setListFilter}
                  onChannelFilterChange={setCustomersListChannelFilter}
                  onSearchChange={setSearchQuery}
                  rows={customerRows}
                  customersSelection={customersSelection}
                  onSelectCustomersRow={(row) => {
                    suppressCustomersAutoSelectRef.current = false;
                    setCustomersSelection(customersSelectionFromRow(row));
                  }}
                  selectedRowKeys={selectedCustomerRowKeys}
                  allRowsSelected={allCustomerRowsSelected}
                  canSelectAllRows={customerRows.length > 0}
                  onToggleRowSelection={toggleCustomerRowSelection}
                  onToggleSelectAllRows={toggleSelectAllCustomerRows}
                  isLoading={customersLoading}
                  isError={customersError}
                  onToggleReadUnreadClick={handleToggleReadUnread}
                  onDeleteClick={handleDeleteCustomersRow}
                  showDeleteButton={selectedCustomerRowKeys.length > 0}
                  deleteDisabled={selectedCustomerConversationIds.length === 0}
                  deleteLabel={customersDeleteLabel}
                  toggleReadUnreadDisabled={
                    !selectedCustomersRow ||
                    markAsReadMutation.isPending ||
                    markAsUnreadMutation.isPending
                  }
                  selectedHasUnread={selectedCustomersRow?.hasUnread ?? false}
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
                  className="w-10 h-10 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-200/70 focus:outline-none"
                >
                  <MessageSquareText className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0" />
            </div>
          </div>

          {/* Column 2: Conversation thread + header + reply (full height; only thread scrolls; composer at bottom) */}
          <div className="flex flex-col min-h-0 h-full min-w-0 overflow-hidden bg-white">
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
                    "absolute top-2 left-2 z-10 w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-200/70 focus:outline-none",
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
                  className="w-10 h-10 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-200/70 focus:outline-none"
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