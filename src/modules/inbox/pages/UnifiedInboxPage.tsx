import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Mail, Phone, Calendar, Search, Filter, Archive, Eye, Plus } from 'lucide-react';
import { ConversationView } from "../components/ConversationView";
import { useMessagesList } from "@/modules/inbox/hooks/useMessages";
import type { InboxCommunication } from "../components/ConversationView";
import type { Message } from "@/modules/inbox/types/inbox.types";

export const UnifiedInboxPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<(string | number)[]>([]);
  const [selectedCommunication, setSelectedCommunication] = useState<InboxCommunication | null>(null);
  const { data: messages, isLoading, isError } = useMessagesList();

  const formatTimestamp = (isoString: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleString();
  };

  const inboxItems: InboxCommunication[] = React.useMemo(() => {
    if (!messages) return [];
    return messages.map((message: Message) => ({
      id: message.id,
      type: message.type,
      from: message.from_name,
      subject: message.subject,
      content: message.content,
      timestamp: formatTimestamp(message.created_at),
      orderId: message.order_id,
      priority: message.priority ?? null,
    }));
  }, [messages]);

  const getIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="h-4 w-4" />;
      case "phone": return <Phone className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700 border-red-200";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default: return "bg-green-100 text-green-700 border-green-200";
    }
  };

  const filteredCommunications = inboxItems.filter(comm => {
    const matchesSearch = searchQuery === "" || 
                         (comm.subject || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                         comm.from.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const toggleSelection = (id: string | number) => {
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
            Read-only view of all messages
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
          <Button variant="outline" size="sm">
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
          <Button>
            <Eye className="h-4 w-4 mr-2" />
            Mark as Read
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages List */}
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="relative">
                All
              </TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {isLoading ? (
                <Card className="p-8 text-center">
                  <div className="text-slate-400">
                    <Mail className="h-12 w-12 mx-auto mb-4" />
                    <p>Loading messages...</p>
                  </div>
                </Card>
              ) : isError ? (
                <Card className="p-8 text-center">
                  <div className="text-slate-400">
                    <Mail className="h-12 w-12 mx-auto mb-4" />
                    <p>Unable to load messages</p>
                  </div>
                </Card>
              ) : filteredCommunications.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-slate-400">
                    <Mail className="h-12 w-12 mx-auto mb-4" />
                    <p>No messages found</p>
                  </div>
                </Card>
              ) : (
                filteredCommunications.map((comm) => (
                  <Card 
                    key={comm.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      ""} ${selectedCommunication?.id === comm.id ? "ring-2 ring-blue-500" : ""}`}
                    onClick={() => setSelectedCommunication(comm)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(comm.id)}
                            onChange={() => toggleSelection(comm.id)}
                            className="rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                          {getIcon(comm.type)}
                          <div className="flex-1">
                            <div className="font-medium">{comm.from}</div>
                            <div className="text-sm text-slate-600 truncate">{comm.subject}</div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">{comm.timestamp}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-9">
                        {comm.priority && (
                          <Badge variant="outline" className={getPriorityColor(comm.priority)}>
                            {comm.priority}
                          </Badge>
                        )}
                        {comm.orderId && (
                          <Badge variant="outline">Order: {comm.orderId}</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-slate-600 line-clamp-2 ml-9">{comm.content}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Conversation View */}
        <div>
          <ConversationView communication={selectedCommunication} />
        </div>
      </div>
    </div>
  );
};

export default UnifiedInboxPage;

