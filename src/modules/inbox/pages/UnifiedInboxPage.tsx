import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/shared/hooks/use-toast';
import { supabase } from '@/shared/lib/supabase';
import { ConversationView } from "../components/ConversationView";
import { InboxConversationList, type ListFilter, type ChannelFilter } from "../components/InboxConversationList";
import { PersonOrdersPanel } from "../components/PersonOrdersPanel";
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
import type { ConversationFilters } from "@/modules/inbox/types/inbox.types";
import { cn } from "@/shared/lib/utils";

const REALTIME_DEBOUNCE_MS = 200;
const GMAIL_POLL_INTERVAL_MS = 10_000;

export const UnifiedInboxPage: React.FC = () => {
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [newConversationModalOpen, setNewConversationModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  /** Select conversation and auto-switch to thread view on mobile */
  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setMobileView('thread');
  };
  const autoReadOnceRef = useRef<Set<string>>(new Set());
  const realtimePendingIdsRef = useRef<Set<string>>(new Set());
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [realtimeInvalidateIds, setRealtimeInvalidateIds] = useState<string[]>([]);
  const setRealtimeInvalidateIdsRef = useRef(setRealtimeInvalidateIds);
  setRealtimeInvalidateIdsRef.current = setRealtimeInvalidateIds;

  const { data: selectedConversation } = useConversation(selectedConversationId);
  const activePersonId = (selectedConversation?.person_id ?? null) as string | null;

  useEffect(() => {
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

  // Channel-scoped filters used for the visible list in the left panel.
  const channelFilters = useMemo<ConversationFilters>(() => {
    if (channelFilter === 'all') return baseFilters;
    return { ...baseFilters, channel: channelFilter };
  }, [baseFilters, channelFilter]);

  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  // Channel-filtered conversations: drive the visible list and most UI behavior.
  const { data: conversations, isLoading, isError } = useConversationsList(channelFilters);
  // All-channel conversations for the same filters: used by Reply via pills so they
  // can always search across every channel regardless of the left-panel filter.
  const { data: allConversations } = useConversationsList(baseFilters);
  const createConversationMutation = useCreateConversation();
  const markAsReadMutation = useMarkAsRead();
  const markAsUnreadMutation = useMarkAsUnread();
  const deleteMutation = useDeleteConversations();
  const syncGmailMutation = useSyncGmail();
  const { data: gmailConnection } = useGmailConnection();
  const { toast } = useToast();
  const gmailPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncGmailMutationRef = useRef(syncGmailMutation);
  syncGmailMutationRef.current = syncGmailMutation;

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
    const map = new Map<string, (typeof conversations)[number]>();
    conversations?.forEach((conversation) => {
      map.set(conversation.id, conversation);
    });
    return map;
  }, [conversations]);

  const allConversationsById = useMemo(() => {
    const map = new Map<string, (typeof allConversations)[number]>();
    allConversations?.forEach((conversation) => {
      map.set(conversation.id, conversation);
    });
    return map;
  }, [allConversations]);

  // Client-side Urgent filter (no backend field): filter by subject/preview containing "urgent"
  const displayConversations = useMemo(() => {
    if (!conversations) return [];
    if (listFilter !== 'urgent') return conversations;
    return conversations.filter(
      (c) =>
        /urgent/i.test(c.subject ?? '') ||
        /urgent/i.test(c.last_message_preview ?? '')
    );
  }, [conversations, listFilter]);

  // Auto-select first (most recent) conversation on load or when selection is no longer in the visible list
  useEffect(() => {
    if (isLoading || isError) return;
    if (displayConversations.length === 0) {
      setSelectedConversationId(null);
      return;
    }
    if (!selectedConversationId) {
      setSelectedConversationId(displayConversations[0].id);
    }
  }, [displayConversations, isLoading, isError, selectedConversationId]);

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

  const handleReplyChannelChange = (target: 'email' | 'sms' | 'whatsapp') => {
    if (!selectedConversationId || !allConversations) return;

    const current = allConversationsById.get(selectedConversationId);
    if (!current || !current.person_id) return;

    // Find the latest conversation for the same person in the target channel,
    // searching across ALL channels, independent of the current left-panel filter.
    const latest = allConversations.find(
      (c) => c.person_id === current.person_id && c.channel === target
    );

    if (!latest) return;

    // Update both the selected conversation and the channel filter so the
    // left panel reflects the new channel.
    setSelectedConversationId(latest.id);
    setChannelFilter(target);
  };

  // Auto-mark conversation as read when opened
  useEffect(() => {
    if (!selectedConversationId) return;

    if (markAsReadMutation.isPending) return;

    const conversation = conversationsById.get(selectedConversationId);
    if (!conversation) return;

    // Only auto-mark supported channels with unread messages
    if (
      conversation.unread_count > 0 &&
      (conversation.channel === "email" || conversation.channel === "sms" || conversation.channel === "whatsapp") &&
      !autoReadOnceRef.current.has(conversation.id)
    ) {
      autoReadOnceRef.current.add(conversation.id);

      markAsReadMutation.mutate([conversation.id], {
        onError: () => {
          toast({
            title: 'Inbox update failed',
            description: 'Could not auto-mark conversation as read. You can still toggle it manually.',
            variant: 'destructive',
          });
        },
      });
    }
  }, [selectedConversationId, conversationsById, markAsReadMutation, toast]);

  // Invalidate conversation/message queries from React lifecycle so All-tab observer refetches (same as Gmail onSuccess).
  useEffect(() => {
    if (realtimeInvalidateIds.length === 0) return;
    queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
    realtimeInvalidateIds.forEach((conversationId) => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.messages.byConversation(conversationId) });
    });
    setRealtimeInvalidateIds([]);
  }, [realtimeInvalidateIds, queryClient]);

  // Realtime: subscribe to inbox_messages INSERT and inbox_conversations UPDATE; debounce then request invalidation via state.
  // Invalidation runs in the effect above (React lifecycle) so it triggers All-tab refetch like Gmail sync onSuccess.
  useEffect(() => {
    const channel = supabase.channel('inbox-realtime');
    const flush = () => {
      realtimeDebounceRef.current = null;
      const ids = Array.from(realtimePendingIdsRef.current);
      realtimePendingIdsRef.current.clear();
      if (ids.length === 0) return;
      setRealtimeInvalidateIdsRef.current(ids);
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
  }, [queryClient]);

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

  const handleToggleReadUnread = () => {
    const ids = toggleTargetIds;
    if (ids.length === 0) return;

    const isMarkingRead = anyToggleTargetUnread;

    const onError = (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update read status';
      toast({
        title: 'Inbox update failed',
        description: message,
        variant: 'destructive',
      });
    };

    if (isMarkingRead) {
      markAsReadMutation.mutate(ids, { onError });
    } else {
      markAsUnreadMutation.mutate(ids, { onError });
    }

    if (selectedItems.length > 0) {
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

  const toggleSelection = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleNewConversationStart = (result: NewConversationResult) => {
    const payload = {
      channel: result.channel,
      primary_handle: result.primary_handle,
      subject: result.subject ?? null,
      person_id: result.person_id ?? null,
    };

    if (result.channel === 'email') {
      createConversationMutation.mutate(payload, {
        onSuccess: (data) => {
          setSelectedConversationId(data.id);
          setChannelFilter('email');
        },
        onError: (error) => {
          toast({
            title: 'Could not start conversation',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
        },
      });
      return;
    }

    if (result.channel === 'whatsapp' && result.person_id && allConversations?.length) {
      const existing = allConversations.find(
        (c) => c.person_id === result.person_id && c.channel === 'whatsapp'
      );
      if (existing) {
        setSelectedConversationId(existing.id);
        setChannelFilter('whatsapp');
        return;
      }
    }

    createConversationMutation.mutate(payload, {
      onSuccess: (data) => {
        setSelectedConversationId(data.id);
        setChannelFilter('whatsapp');
      },
      onError: (error) => {
        toast({
          title: 'Could not start conversation',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <NewConversationModal
        open={newConversationModalOpen}
        onOpenChange={setNewConversationModalOpen}
        onStart={handleNewConversationStart}
      />
      {/* Three-column layout: fixed-height workspace, no page scroll */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col border border-gardens-bdr rounded-lg bg-gardens-surf2 shadow-sm">
        <div
          className={cn(
            'flex-1 min-h-0 grid grid-rows-1 gap-0 overflow-hidden',
            'lg:grid-cols-[280px_minmax(0,1fr)_280px] xl:grid-cols-[300px_minmax(0,1fr)_300px]'
          )}
        >
          {/* Column 1: Conversation list with filters and channel pills */}
          <div className={cn(
            'min-h-0 h-full flex-col overflow-hidden border-r border-gardens-bdr bg-gardens-surf p-2',
            mobileView === 'thread' ? 'hidden lg:flex' : 'flex'
          )}>
            <InboxConversationList
            listFilter={listFilter}
            channelFilter={channelFilter}
            searchQuery={searchQuery}
            onListFilterChange={setListFilter}
            onChannelFilterChange={setChannelFilter}
            onSearchChange={setSearchQuery}
            conversations={displayConversations}
            selectedConversationId={selectedConversationId}
            selectedItems={selectedItems}
            onSelectConversation={handleSelectConversation}
            onToggleSelection={toggleSelection}
            onNewClick={() => setNewConversationModalOpen(true)}
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
          </div>

          {/* Column 2: Conversation thread + header + reply (full height; only thread scrolls; composer at bottom) */}
          <div className={cn(
            'flex-col min-h-0 h-full min-w-0 overflow-hidden bg-gardens-page',
            mobileView === 'list' ? 'hidden lg:flex' : 'flex'
          )}>
            {/* Mobile back button */}
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="lg:hidden flex items-center gap-1 px-3 py-2 text-xs font-medium text-gardens-acc border-b border-gardens-bdr bg-gardens-surf"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="10,2 4,8 10,14"/></svg>
              Back to inbox
            </button>
            <ConversationView
              conversationId={selectedConversationId}
              onReplyChannelChange={handleReplyChannelChange}
            />
          </div>

          {/* Column 3: Order context panel */}
          <div className="hidden lg:flex lg:flex-col min-h-0 h-full min-w-0 overflow-hidden">
            <PersonOrdersPanel
            personId={activePersonId}
            selectedOrderId={selectedOrderId}
            onSelectOrder={setSelectedOrderId}
            onCloseOrder={() => setSelectedOrderId(null)}
          />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedInboxPage;
