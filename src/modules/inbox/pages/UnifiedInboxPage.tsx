import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Mail, Phone, Calendar, Search, Filter, Archive, Eye, Plus } from 'lucide-react';
import { ConversationView } from "../components/ConversationView";

// Demo data - will be replaced with real Supabase queries in Phase 1 integration
type Communication = {
  id: number;
  type: "email" | "phone" | "calendar";
  from: string;
  subject: string;
  content: string;
  timestamp: string;
  status: "unread" | "read";
  orderId: string;
  priority: "high" | "medium" | "low";
};

const communications: Communication[] = [
  {
    id: 1,
    type: "email",
    from: "john.smith@email.com",
    subject: "Memorial design inquiry",
    content: "I would like to discuss options for a granite headstone for my father's memorial. We need it completed by early July.",
    timestamp: "2 hours ago",
    status: "unread",
    orderId: "ORD-001",
    priority: "high",
    depositDate: "2025-05-20",
    productOrdered: "Granite Headstone",
    orderValue: "$2,500"
  },
  {
    id: 2,
    type: "phone",
    from: "Sarah Johnson",
    subject: "Installation scheduling",
    content: "Called regarding installation date for memorial at Oak Hill Cemetery. Requested callback to confirm timing.",
    timestamp: "4 hours ago",
    status: "read",
    orderId: "ORD-002",
    priority: "medium"
  },
  {
    id: 3,
    type: "email",
    from: "mike.brown@email.com",
    subject: "Quote approval needed",
    content: "Please review the updated quote for the marble memorial. We've made the requested changes to the inscription.",
    timestamp: "1 day ago",
    status: "unread",
    orderId: "ORD-003",
    priority: "medium"
  }
];

export const UnifiedInboxPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null);

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

  const filteredCommunications = communications.filter(comm => {
    const matchesTab = activeTab === "all" || 
                      (activeTab === "unread" && comm.status === "unread") ||
                      comm.type === activeTab;
    const matchesSearch = searchQuery === "" || 
                         comm.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         comm.from.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const unreadCount = communications.filter(c => c.status === "unread").length;

  const toggleSelection = (id: number) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const markAsRead = (ids: number[]) => {
    console.log("Marking as read:", ids);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Unified Inbox</h1>
          <p className="text-sm text-slate-600 mt-1">
            {unreadCount} unread messages
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
          <Button onClick={() => markAsRead(selectedItems)}>
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
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 w-5 text-xs p-0 flex items-center justify-center">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {filteredCommunications.length === 0 ? (
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
                      comm.status === "unread" ? "border-blue-200 bg-blue-50" : ""
                    } ${selectedCommunication?.id === comm.id ? "ring-2 ring-blue-500" : ""}`}
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
                        {comm.status === "unread" && <Badge variant="default">New</Badge>}
                        <Badge variant="outline" className={getPriorityColor(comm.priority)}>
                          {comm.priority}
                        </Badge>
                        <Badge variant="outline">Order: {comm.orderId}</Badge>
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

