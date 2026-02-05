import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Mail, Phone, MessageSquare, Search, Archive, Eye } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { ConversationView } from "../components/ConversationView";
import { PeopleSidebar } from "../components/PeopleSidebar";
import { PersonOrdersPanel } from "../components/PersonOrdersPanel";
import { useConversationsList, useConversation, useMarkAsRead, useArchiveConversations, useSyncGmail } from "@/modules/inbox/hooks/useInboxConversations";
import { formatConversationTimestamp } from "@/modules/inbox/utils/conversationUtils";
import type { ConversationFilters } from "@/modules/inbox/types/inbox.types";

export const UnifiedInboxPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

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

  const { data: conversations, isLoading, isError } = useConversationsList(filters);
  const markAsReadMutation = useMarkAsRead();
  const archiveMutation = useArchiveConversations();
  const syncGmailMutation = useSyncGmail();
  const { toast } = useToast();

  const handleSyncEmail = () => {
    syncGmailMutation.mutate(undefined, {
      onSuccess: (data) => {
        toast({
          title: 'Email sync completed',
          description: `Synced ${data.syncedCount} messages, skipped ${data.skippedCount}, ${data.errorsCount} errors`,
        });
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'Failed to sync email';
        toast({
          title: 'Email sync failed',
          description: message,
          variant: 'destructive',
        });
      },
    });
  };

  const getIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-4 w-4" />;
      case "sms":
      case "whatsapp": return <Phone className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const handleMarkAsRead = () => {
    if (selectedItems.length > 0) {
      markAsReadMutation.mutate(selectedItems);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Unified Inbox</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage conversations from all channels
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSyncEmail}
            disabled={syncGmailMutation.isPending}
          >
            {syncGmailMutation.isPending ? 'Syncing…' : 'Sync Email'}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleArchive}
            disabled={selectedItems.length === 0}
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
          <Button 
            onClick={handleMarkAsRead}
            disabled={selectedItems.length === 0}
          >
            <Eye className="h-4 w-4 mr-2" />
            Mark as Read
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[180px_260px_1fr] gap-4 min-h-[480px] min-w-0">
        {/* People column: 180px, scroll contained */}
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
          <PeopleSidebar
            selectedPersonId={selectedPersonId}
            onSelectPerson={setSelectedPersonId}
          />
        </div>
        {/* Conversations column: 260px, scroll contained */}
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-4 gap-1 bg-muted/40 p-1 rounded-lg w-full h-auto">
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

            <TabsContent value={activeTab} className="flex-1 min-h-0 overflow-auto space-y-2 mt-2">
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
                    <CardHeader className="p-2">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
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
            </TabsContent>
          </Tabs>
        </div>

        {/* Conversation panel column: 1fr, message list scrolls inside ConversationView */}
        <div className="min-h-0 min-w-0 flex flex-col gap-4">
          <div className="flex-1 min-h-[200px] min-w-0 flex flex-col overflow-hidden">
            <ConversationView conversationId={selectedConversationId} />
          </div>
          <PersonOrdersPanel
            personId={activePersonId}
            selectedOrderId={selectedOrderId}
            onSelectOrder={setSelectedOrderId}
            onCloseOrder={() => setSelectedOrderId(null)}
          />
        </div>
      </div>
    </div>
  );
};

export default UnifiedInboxPage;
