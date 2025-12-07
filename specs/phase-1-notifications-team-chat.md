# Phase 1: Notifications & Team Chat Modules

## Overview

Add two new placeholder feature modules to the existing Phase-1 modular architecture:
1. **Notifications** - A notification center page
2. **Team Chat** - An enhanced team chat page with proper chat layout

These are placeholder UI pages only - no integrations, workflows, or real-time functionality.

---

## Current State Analysis

### Existing Team Module
- `src/modules/team/pages/TeamChatPage.tsx` exists with minimal placeholder
- `src/modules/team/index.ts` exports TeamChatPage
- **Not routed** in `src/app/router.tsx`
- **Not in navigation** in `src/app/layout/AppSidebar.tsx`

### Notifications Module
- **Does not exist** - needs to be created from scratch

### Router State
Current routes under `/dashboard`:
- `/dashboard/inbox` → UnifiedInboxPage
- `/dashboard/map` → JobsMapPage  
- `/dashboard/orders` → OrdersPage
- `/dashboard/invoicing` → InvoicingPage
- `/dashboard/reporting` → ReportingPage

### Sidebar Navigation
Current items:
- Unified Inbox, Map of Jobs, Orders, Invoicing, Reporting

---

## Target State

### New Routes
| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard/notifications` | NotificationsPage | Notification center |
| `/dashboard/team` | TeamChatPage | Team chat interface |

### New Navigation Items
| Title | URL | Icon |
|-------|-----|------|
| Notifications | `/dashboard/notifications` | `Bell` |
| Team Chat | `/dashboard/team` | `MessageSquare` |

---

## Files to Create

### 1. Notifications Module

**`src/modules/notifications/pages/NotificationsPage.tsx`**

Placeholder UI with:
- Page header with title and description
- Notification filter tabs (All, Unread, Mentions)
- List of demo notifications with:
  - Icon (based on notification type)
  - Title and description
  - Timestamp
  - Read/unread indicator
  - Action buttons (Mark as read, Dismiss)
- Empty state when no notifications

**`src/modules/notifications/index.ts`**

Barrel export for the module.

### 2. Enhanced Team Chat Module

**`src/modules/team/pages/TeamChatPage.tsx`** (UPDATE existing)

Proper chat layout with:
- Left sidebar: channel/user list with demo channels
- Main area: message list with demo messages
- Bottom: message input box (non-functional)
- Header: current channel name and member count

---

## Files to Modify

### 1. Router

**`src/app/router.tsx`**

Add routes:
```tsx
import { NotificationsPage } from "@/modules/notifications";
import { TeamChatPage } from "@/modules/team";

// Inside Routes under dashboard:
<Route path="notifications" element={<NotificationsPage />} />
<Route path="team" element={<TeamChatPage />} />
```

### 2. Sidebar Navigation

**`src/app/layout/AppSidebar.tsx`**

Add navigation items:
```tsx
import { Bell, MessageSquare } from 'lucide-react';

// Add to navigationItems array:
{ title: "Notifications", url: "/dashboard/notifications", icon: Bell },
{ title: "Team Chat", url: "/dashboard/team", icon: MessageSquare },
```

---

## Demo Data Specifications

### Notifications Demo Data

```typescript
const demoNotifications = [
  {
    id: 1,
    type: "order", // order | message | system | reminder
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
```

### Team Chat Demo Data

```typescript
const demoChannels = [
  { id: "general", name: "General", unread: 2 },
  { id: "orders", name: "Orders", unread: 0 },
  { id: "installations", name: "Installations", unread: 5 },
];

const demoMembers = [
  { id: 1, name: "Mike Johnson", status: "online" },
  { id: 2, name: "Sarah Davis", status: "online" },
  { id: 3, name: "Tom Wilson", status: "away" },
];

const demoMessages = [
  {
    id: 1,
    sender: "Mike Johnson",
    content: "Just finished the installation at Oak Hill Cemetery",
    timestamp: "10:30 AM",
    isOwn: false
  },
  {
    id: 2,
    sender: "You",
    content: "Great work! How did the client react?",
    timestamp: "10:32 AM",
    isOwn: true
  },
  {
    id: 3,
    sender: "Mike Johnson",
    content: "They were very happy with the final result. The family was emotional but thankful.",
    timestamp: "10:35 AM",
    isOwn: false
  }
];
```

---

## Module Structure

### Notifications Module
```
src/modules/notifications/
├── pages/
│   └── NotificationsPage.tsx
└── index.ts
```

### Team Module (Enhanced)
```
src/modules/team/
├── pages/
│   └── TeamChatPage.tsx    # UPDATE
└── index.ts                # Already exists
```

---

## Naming Conventions

Following Phase 1 established patterns:
- Pages: `{Feature}Page.tsx`
- Exports: Named exports (e.g., `export const NotificationsPage`)
- Barrel exports: `export { ComponentName } from './path'`
- Imports: Use `@/` aliases

---

## UI Component Requirements

### Notifications Page
- Use shadcn/ui: `Card`, `Button`, `Badge`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- Icons from lucide-react: `Bell`, `BellOff`, `Package`, `MessageSquare`, `AlertCircle`, `Check`

### Team Chat Page
- Use shadcn/ui: `Card`, `Button`, `Input`, `Avatar`, `AvatarFallback`, `ScrollArea`, `Badge`
- Icons from lucide-react: `MessageSquare`, `Send`, `Hash`, `Circle`, `Users`

---

## Validation Checklist

After implementation, verify:

- [ ] `NotificationsPage` renders at `/dashboard/notifications`
- [ ] `TeamChatPage` renders at `/dashboard/team`
- [ ] Both pages appear in sidebar navigation
- [ ] Navigation highlighting works correctly
- [ ] Pages match the visual style of existing modules
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] No modifications to existing module code or CRUD hooks

---

## Out of Scope

The following are explicitly NOT included in this specification:

- Real-time WebSocket connections
- Push notifications
- Notification preferences/settings
- Message sending functionality
- Channel creation/management
- User presence system
- Read receipts
- File attachments
- Database tables or migrations
- CRUD hooks
- API integrations
- Any third-party service integrations

---

## Implementation Notes

1. Both pages should use existing shared components from `@/shared/components/ui/`
2. Follow the same header pattern as other pages (title + description)
3. Use consistent card layouts and spacing
4. Demo data should be defined inline in the component files
5. No state management beyond basic React useState for UI interactions

