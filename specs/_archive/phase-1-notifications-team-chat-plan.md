# Implementation Plan: Notifications & Team Chat Modules

**Branch:** `feature/phase-1-notifications-team-chat`  
**Specification:** `specs/phase-1-notifications-team-chat.md`

---

## Task Summary

| # | Task | Type | File | Priority |
|---|------|------|------|----------|
| 1 | Create notifications module directory | Setup | `src/modules/notifications/pages/` | High |
| 2 | Create NotificationsPage component | Create | `src/modules/notifications/pages/NotificationsPage.tsx` | High |
| 3 | Create notifications barrel export | Create | `src/modules/notifications/index.ts` | High |
| 4 | Enhance TeamChatPage component | Update | `src/modules/team/pages/TeamChatPage.tsx` | High |
| 5 | Update router with new routes | Update | `src/app/router.tsx` | High |
| 6 | Update sidebar navigation | Update | `src/app/layout/AppSidebar.tsx` | High |
| 7 | Validate build and routing | Verify | - | High |

---

## Task 1: Create Notifications Module Directory

**Action:** Create directory structure

```
src/modules/notifications/
└── pages/
```

**Command:**
```powershell
New-Item -ItemType Directory -Force -Path "src/modules/notifications/pages"
```

---

## Task 2: Create NotificationsPage Component

**File:** `src/modules/notifications/pages/NotificationsPage.tsx`  
**Action:** CREATE

```tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { 
  Bell, 
  BellOff, 
  Package, 
  MessageSquare, 
  AlertCircle, 
  Check,
  X,
  Clock
} from 'lucide-react';

// Demo notification data
const demoNotifications = [
  {
    id: 1,
    type: "order",
    title: "New order received",
    description: "John Smith placed order ORD-004 for Granite Headstone",
    timestamp: "5 minutes ago",
    isRead: false,
    orderId: "ORD-004"
  },
  {
    id: 2,
    type: "message",
    title: "New message from Sarah Johnson",
    description: "RE: Installation scheduling for Greenwood Memorial",
    timestamp: "1 hour ago",
    isRead: false
  },
  {
    id: 3,
    type: "reminder",
    title: "Order due soon",
    description: "ORD-002 is due in 3 days - verify installation readiness",
    timestamp: "2 hours ago",
    isRead: true
  },
  {
    id: 4,
    type: "system",
    title: "System update complete",
    description: "The latest updates have been applied successfully",
    timestamp: "1 day ago",
    isRead: true
  }
];

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "order": return <Package className="h-5 w-5 text-blue-600" />;
    case "message": return <MessageSquare className="h-5 w-5 text-green-600" />;
    case "reminder": return <Clock className="h-5 w-5 text-yellow-600" />;
    case "system": return <AlertCircle className="h-5 w-5 text-slate-600" />;
    default: return <Bell className="h-5 w-5 text-slate-600" />;
  }
};

export const NotificationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState(demoNotifications);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !notification.isRead;
    return false;
  });

  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const dismissNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-slate-600 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <Check className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="relative">
            All
            {notifications.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {notifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread" className="relative">
            Unread
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-4">
          {filteredNotifications.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-slate-400">
                <BellOff className="h-12 w-12 mx-auto mb-4" />
                <p className="text-lg font-medium">No notifications</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            </Card>
          ) : (
            filteredNotifications.map((notification) => (
              <Card 
                key={notification.id}
                className={`transition-all hover:shadow-md ${
                  !notification.isRead ? "border-blue-200 bg-blue-50/50" : ""
                }`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${
                      !notification.isRead ? "bg-blue-100" : "bg-slate-100"
                    }`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{notification.title}</h4>
                        {!notification.isRead && (
                          <Badge variant="default" className="text-xs">New</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {notification.description}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        {notification.timestamp}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.isRead && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => dismissNotification(notification.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationsPage;
```

---

## Task 3: Create Notifications Barrel Export

**File:** `src/modules/notifications/index.ts`  
**Action:** CREATE

```typescript
export { NotificationsPage } from './pages/NotificationsPage';
```

---

## Task 4: Enhance TeamChatPage Component

**File:** `src/modules/team/pages/TeamChatPage.tsx`  
**Action:** UPDATE (replace entire file)

```tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Hash, Send, Circle, Users, MessageSquare } from 'lucide-react';

// Demo data
const demoChannels = [
  { id: "general", name: "General", unread: 2 },
  { id: "orders", name: "Orders", unread: 0 },
  { id: "installations", name: "Installations", unread: 5 },
];

const demoMembers = [
  { id: 1, name: "Mike Johnson", status: "online", initials: "MJ" },
  { id: 2, name: "Sarah Davis", status: "online", initials: "SD" },
  { id: 3, name: "Tom Wilson", status: "away", initials: "TW" },
];

const demoMessages = [
  {
    id: 1,
    sender: "Mike Johnson",
    initials: "MJ",
    content: "Just finished the installation at Oak Hill Cemetery",
    timestamp: "10:30 AM",
    isOwn: false
  },
  {
    id: 2,
    sender: "You",
    initials: "ME",
    content: "Great work! How did the client react?",
    timestamp: "10:32 AM",
    isOwn: true
  },
  {
    id: 3,
    sender: "Mike Johnson",
    initials: "MJ",
    content: "They were very happy with the final result. The family was emotional but thankful.",
    timestamp: "10:35 AM",
    isOwn: false
  },
  {
    id: 4,
    sender: "Sarah Davis",
    initials: "SD",
    content: "That's wonderful to hear! Great job Mike 👏",
    timestamp: "10:40 AM",
    isOwn: false
  },
  {
    id: 5,
    sender: "You",
    initials: "ME",
    content: "Agreed! Let's make sure the photos are added to the portfolio.",
    timestamp: "10:42 AM",
    isOwn: true
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "online": return "bg-green-500";
    case "away": return "bg-yellow-500";
    default: return "bg-slate-400";
  }
};

export const TeamChatPage: React.FC = () => {
  const [selectedChannel, setSelectedChannel] = useState("general");
  const [messageInput, setMessageInput] = useState("");

  const selectedChannelData = demoChannels.find(c => c.id === selectedChannel);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Chat</h1>
        <p className="text-sm text-slate-600 mt-1">
          Communicate with your team in real-time
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-220px)]">
        {/* Sidebar - Channels & Members */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-1">
                {demoChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors ${
                      selectedChannel === channel.id 
                        ? "bg-blue-100 text-blue-700" 
                        : "hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      <span className="text-sm font-medium">{channel.name}</span>
                    </div>
                    {channel.unread > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {channel.unread}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-6 pb-4">
                <div className="flex items-center gap-2 px-3 mb-3">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-600">Team Members</span>
                </div>
                <div className="space-y-2">
                  {demoMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{member.initials}</AvatarFallback>
                        </Avatar>
                        <Circle 
                          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 ${getStatusColor(member.status)} rounded-full border-2 border-white`}
                          fill="currentColor"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{member.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="lg:col-span-3 flex flex-col">
          {/* Channel Header */}
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-slate-500" />
                <CardTitle className="text-lg">{selectedChannelData?.name}</CardTitle>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Users className="h-4 w-4" />
                <span>{demoMembers.length} members</span>
              </div>
            </div>
          </CardHeader>

          {/* Messages */}
          <CardContent className="flex-1 p-0 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {demoMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.isOwn ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">{message.initials}</AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[70%] ${message.isOwn ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${message.isOwn ? "text-blue-600" : ""}`}>
                          {message.sender}
                        </span>
                        <span className="text-xs text-slate-400">{message.timestamp}</span>
                      </div>
                      <div
                        className={`px-4 py-2 rounded-lg ${
                          message.isOwn
                            ? "bg-blue-500 text-white"
                            : "bg-slate-100 text-slate-900"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder={`Message #${selectedChannelData?.name}...`}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="flex-1"
                />
                <Button>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Press Enter to send (coming in Phase 2)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamChatPage;
```

---

## Task 5: Update Router with New Routes

**File:** `src/app/router.tsx`  
**Action:** UPDATE

### Changes Required:

**1. Add imports (after existing imports):**
```tsx
import { NotificationsPage } from "@/modules/notifications";
import { TeamChatPage } from "@/modules/team";
```

**2. Add routes (inside dashboard Route, after reporting):**
```tsx
<Route path="notifications" element={<NotificationsPage />} />
<Route path="team" element={<TeamChatPage />} />
```

### Full Updated File:
```tsx
import { Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./layout/DashboardLayout";
import { LandingPage } from "@/modules/landing";
import { UnifiedInboxPage } from "@/modules/inbox";
import { JobsMapPage } from "@/modules/jobs";
import { OrdersPage } from "@/modules/orders";
import { InvoicingPage } from "@/modules/invoicing";
import { ReportingPage } from "@/modules/reporting";
import { NotificationsPage } from "@/modules/notifications";
import { TeamChatPage } from "@/modules/team";
import NotFound from "@/pages/NotFound";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route path="inbox" element={<UnifiedInboxPage />} />
        <Route path="map" element={<JobsMapPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="invoicing" element={<InvoicingPage />} />
        <Route path="reporting" element={<ReportingPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="team" element={<TeamChatPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

---

## Task 6: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

### Changes Required:

**1. Update icon imports:**
```tsx
import { Inbox, MapPin, FileText, ChartBar, ListCheck, Bell, MessageSquare } from 'lucide-react';
```

**2. Add navigation items:**
```tsx
const navigationItems = [
  { title: "Unified Inbox", url: "/dashboard/inbox", icon: Inbox },
  { title: "Map of Jobs", url: "/dashboard/map", icon: MapPin },
  { title: "Orders", url: "/dashboard/orders", icon: ListCheck },
  { title: "Invoicing", url: "/dashboard/invoicing", icon: FileText },
  { title: "Reporting", url: "/dashboard/reporting", icon: ChartBar },
  { title: "Notifications", url: "/dashboard/notifications", icon: Bell },
  { title: "Team Chat", url: "/dashboard/team", icon: MessageSquare },
];
```

---

## Task 7: Validate Build and Routing

**Actions:**
1. Run `npm run build` to verify no TypeScript errors
2. Run `npm run dev` to test navigation
3. Verify routes:
   - `/dashboard/notifications` loads NotificationsPage
   - `/dashboard/team` loads TeamChatPage
4. Verify sidebar navigation items appear and highlight correctly

---

## Execution Order

| Step | Task | Dependencies |
|------|------|--------------|
| 1 | Create notifications directory | None |
| 2 | Create NotificationsPage | Step 1 |
| 3 | Create notifications index.ts | Step 2 |
| 4 | Update TeamChatPage | None |
| 5 | Update router.tsx | Steps 3, 4 |
| 6 | Update AppSidebar.tsx | None |
| 7 | Validate build | Steps 1-6 |

---

## Import Path Reference

All imports must use absolute paths with `@/` alias:

| Component | Import Path |
|-----------|-------------|
| Card, CardContent, CardHeader, CardTitle | `@/shared/components/ui/card` |
| Button | `@/shared/components/ui/button` |
| Badge | `@/shared/components/ui/badge` |
| Tabs, TabsContent, TabsList, TabsTrigger | `@/shared/components/ui/tabs` |
| Input | `@/shared/components/ui/input` |
| Avatar, AvatarFallback | `@/shared/components/ui/avatar` |
| ScrollArea | `@/shared/components/ui/scroll-area` |
| NotificationsPage | `@/modules/notifications` |
| TeamChatPage | `@/modules/team` |

---

## Safety Checklist

- [ ] No modifications to existing CRUD hooks
- [ ] No database tables or migrations created
- [ ] No real-time functionality implemented
- [ ] No third-party integrations added
- [ ] All imports use correct `@/` aliases
- [ ] Build succeeds with no TypeScript errors
- [ ] Navigation works correctly

---

## Files Summary

### New Files (2)
| File | Purpose |
|------|---------|
| `src/modules/notifications/pages/NotificationsPage.tsx` | Notifications center page |
| `src/modules/notifications/index.ts` | Module barrel export |

### Modified Files (3)
| File | Changes |
|------|---------|
| `src/modules/team/pages/TeamChatPage.tsx` | Enhanced with chat layout |
| `src/app/router.tsx` | Add 2 new routes |
| `src/app/layout/AppSidebar.tsx` | Add 2 navigation items |

