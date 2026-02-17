import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { ChevronLeft, ChevronRight, Mail, Phone, MessageSquare, Search, Archive, Eye, EyeOff } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { useToast } from '@/shared/hooks/use-toast';
import { supabase } from '@/shared/lib/supabase';
import { ConversationView } from "../components/ConversationView";
import { PeopleSidebar } from "../components/PeopleSidebar";
import { PersonOrdersPanel } from "../components/PersonOrdersPanel";
import { AllMessagesTimeline } from "../components/AllMessagesTimeline";
import {
  inboxKeys,
  useConversationsList,
  useConversation,
  useMarkAsRead,
  useMarkAsUnread,
  useArchiveConversations,
  useSyncGmail,
} from "@/modules/inbox/hooks/useInboxConversations";
import { formatConversationTimestamp } from "@/modules/inbox/utils/conversationUtils";
import type { ConversationFilters } from "@/modules/inbox/types/inbox.types";

const REALTIME_DEBOUNCE_MS = 200;
const GMAIL_POLL_INTERVAL_MS = 60_000;

export const UnifiedInboxPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const autoReadOnceRef = useRef<Set<string>>(new Set());
  const realtimePendingIdsRef = useRef<Set<string>>(new Set());
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: selectedConversation } = useConversation(selectedConversationId);
  const activePersonId = (selectedConversation?.person_id ?? selectedPersonId ?? null) as string | null;

  useEffect(() => {
    setSelectedOrderId(null);
  }, [activePersonId]);

  // Map tab to filters
  const filters = React.useMemo<ConversationFilters>(() => {
    const base: ConversationFilters = { status: 'open' };
    
    if (activeTab === 'email') {
      base.channel = 'email';
    } else if (activeTab === 'sms') {
      base.channel = 'sms';
    } else if (activeTab === 'whatsapp') {
      base.channel = 'whatsapp';
    }
    
    if (searchQuery.trim()) {
      base.search = searchQuery;
    }

    if (selectedPersonId != null) {
      base.person_id = selectedPersonId;
    } else {
      base.unlinked_only = true;
    }
    
    return base;
  }, [activeTab, searchQuery, selectedPersonId]);

  const queryClient = useQueryClient();
  const { data: conversations, isLoading, isError } = useConversationsList(filters);
  const markAsReadMutation = useMarkAsRead();
  const markAsUnreadMutation = useMarkAsUnread();
  const archiveMutation = useArchiveConversations();
  const syncGmailMutation = useSyncGmail();
  const { toast } = useToast();
  const gmailPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncGmailMutationRef = useRef(syncGmailMutation);
  syncGmailMutationRef.current = syncGmailMutation;

  const conversationsById = useMemo(() => {
    const map = new Map<string, (typeof conversations)[number]>();
    conversations?.forEach((conversation) => {
      map.set(conversation.id, conversation);
    });
    return map;
  }, [conversations]);

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

  // Realtime: subscribe once to inbox_messages INSERT; debounced invalidation only (no cache patch).
  // Existing inbox queries do not filter by company_id/org_id; RLS applies to Realtime payloads.
  useEffect(() => {
    const channel = supabase.channel('inbox-messages');
    const flush = () => {
      realtimeDebounceRef.current = null;
      const ids = Array.from(realtimePendingIdsRef.current);
      realtimePendingIdsRef.current.clear();
      if (ids.length === 0) return;
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
      ids.forEach((conversationId) => {
        queryClient.invalidateQueries({ queryKey: inboxKeys.messages.byConversation(conversationId) });
      });
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

  // Gmail auto-sync: poll every 60s while page is mounted; guard so we don't overlap.
  useEffect(() => {
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
  }, []);

  const getIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-4 w-4" />;
      case "sms":
      case "whatsapp": return <Phone className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

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

  const handleArchive = () => {
    if (selectedItems.length > 0) {
      archiveMutation.mutate(selectedItems);
      setSelectedItems([]);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Unified Inbox</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage conversations from all channels
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            disabled={selectedItems.length === 0}
          >
            <Archive className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Archive</span>
          </Button>
          <Button
            size="sm"
            onClick={handleToggleReadUnread}
            disabled={toggleTargetIds.length === 0 || markAsReadMutation.isPending || markAsUnreadMutation.isPending}
          >
            {anyToggleTargetUnread ? (
              <>
                <Eye className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Mark as Read</span>
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Mark as Unread</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-1.5">
        <TabsList className="grid w-full grid-cols-4 gap-1 bg-muted/40 p-0.5 rounded-lg w-full max-w-md h-auto">
          <TabsTrigger
            value="all"
            className="h-8 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
          >
            All
          </TabsTrigger>
          <TabsTrigger
            value="email"
            className="h-8 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
          >
            Email
          </TabsTrigger>
          <TabsTrigger
            value="sms"
            className="h-8 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
          >
            SMS
          </TabsTrigger>
          <TabsTrigger
            value="whatsapp"
            className="h-8 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
          >
            WhatsApp
          </TabsTrigger>
        </TabsList>

        {(() => {
          const showUnifiedTimeline = activeTab === 'all' && selectedPersonId != null;
          const gridColsLg = isSidebarCollapsed
            ? 'lg:grid-cols-[64px_minmax(0,1fr)_300px] xl:grid-cols-[64px_minmax(0,1fr)_360px]'
            : 'lg:grid-cols-[160px_minmax(0,1fr)_300px] xl:grid-cols-[180px_minmax(0,1fr)_360px]';
          return (
            <div className={cn(
              "grid gap-4 min-h-[480px] min-h-0 min-w-0 grid-cols-1",
              gridColsLg
            )}>
              {/* Column 1: People sidebar */}
              <div className="h-full min-h-0 flex flex-col overflow-hidden">
                <div className="hidden lg:flex justify-end px-1 pt-1 pb-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                    aria-label={isSidebarCollapsed ? 'Expand people sidebar' : 'Collapse people sidebar'}
                  >
                    {isSidebarCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <PeopleSidebar
                  selectedPersonId={selectedPersonId}
                  onSelectPerson={setSelectedPersonId}
                  collapsed={isSidebarCollapsed}
                />
              </div>

              {/* Column 2: Conversation area */}
              <div className="min-h-0 min-w-0 flex flex-col overflow-hidden">
                {showUnifiedTimeline ? (
                  <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
                    <AllMessagesTimeline
                      personId={selectedPersonId}
                      onOpenThread={({ channel, conversationId }) => {
                        setActiveTab(channel);
                        setSelectedConversationId(conversationId);
                      }}
                    />
                  </div>
                ) : (
                  <div className="min-h-0 min-w-0 grid gap-3 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
                    {/* Conversations column: only for Email/SMS/WhatsApp */}
                    <div className="h-full min-h-0 flex flex-col overflow-hidden">
                      <div className="flex-1 min-h-0 overflow-auto space-y-2">
                        {isLoading ? (
                          <Card className="p-8 text-center">
                            <div className="text-slate-400">
                              <Mail className="h-12 w-12 mx-auto mb-4" />
                              <p>Loading conversations...</p>
                            </div>
                          </Card>
                        ) : isError ? (
                          <Card className="p-8 text-center">
                            <div className="text-slate-400">
                              <Mail className="h-12 w-12 mx-auto mb-4" />
                              <p>Unable to load conversations</p>
                            </div>
                          </Card>
                        ) : !conversations || conversations.length === 0 ? (
                          <Card className="p-8 text-center">
                            <div className="text-slate-400">
                              <Mail className="h-12 w-12 mx-auto mb-4" />
                              <p>No conversations found</p>
                            </div>
                          </Card>
                        ) : (
                          conversations.map((conversation) => (
                            <Card
                              key={conversation.id}
                              className={`cursor-pointer transition-all rounded-md border-b last:border-b-0 hover:bg-muted/30 ${
                                selectedConversationId === conversation.id
                                  ? 'bg-muted/50 ring-1 ring-primary/30 border-l-2 border-l-primary'
                                  : ''
                              }`}
                              onClick={() => setSelectedConversationId(conversation.id)}
                            >
                            <CardHeader className="px-2 py-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1 min-w-0 flex-1">
                                    <input
                                      type="checkbox"
                                      checked={selectedItems.includes(conversation.id)}
                                      onChange={() => toggleSelection(conversation.id)}
                                      className="rounded shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    {getIcon(conversation.channel)}
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-medium truncate">{conversation.primary_handle}</div>
                                      <div className="text-[11px] text-muted-foreground truncate leading-tight">
                                        {conversation.subject || conversation.last_message_preview || ''}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground shrink-0">
                                    {formatConversationTimestamp(conversation.last_message_at)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 ml-6 mt-0.5">
                                  {conversation.unread_count > 0 && (
                                    <Badge variant="default" className="bg-blue-500 text-[10px] px-1.5 py-0.5 rounded-sm">
                                      {conversation.unread_count} unread
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0.5 rounded-sm">
                                    {conversation.channel}
                                  </Badge>
                                </div>
                              </CardHeader>
                            </Card>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Conversation panel column: 1fr, message list scrolls inside ConversationView */}
                    <div className="min-h-0 min-w-0 flex flex-col gap-4">
                      <div className="flex-1 min-h-[200px] min-w-0 flex flex-col overflow-hidden">
                        <ConversationView conversationId={selectedConversationId} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Column 3: Related Orders panel */}
              <div className="hidden lg:flex lg:flex-col min-h-0 min-w-0 overflow-hidden">
                <PersonOrdersPanel
                  personId={activePersonId}
                  selectedOrderId={selectedOrderId}
                  onSelectOrder={setSelectedOrderId}
                  onCloseOrder={() => setSelectedOrderId(null)}
                />
              </div>
            </div>
          );
        })()}
      </Tabs>
    </div>
  );
};

export default UnifiedInboxPage;
