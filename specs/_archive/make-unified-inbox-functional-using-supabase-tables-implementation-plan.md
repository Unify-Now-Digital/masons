# Implementation Plan: Make Unified Inbox Module Functional Using Supabase Tables

## Feature Overview

Replace all legacy `public.messages` table usage with new Supabase-backed inbox tables (`inbox_conversations`, `inbox_messages`, `inbox_channel_accounts`, `contact_handles`) to create a fully functional, DB-backed unified inbox v1 with conversation threading, filtering, search, and reply capabilities.

**Branch:** `feature/make-unified-inbox-functional-using-supabase-tables`  
**Spec File:** `specs/make-unified-inbox-functional-using-supabase-tables.md`

---

## Technical Context

### Current State
- Inbox reads from legacy `public.messages` table via `useMessagesList()` hook
- Displays flat list of messages (no conversation grouping)
- Read-only view (no reply functionality)
- No filtering by channel or status
- No `unread_count` aggregation or `last_message_preview` metadata
- UI layout: left panel (list) → right panel (details/thread) + reply box

### New Tables
- `public.inbox_conversations` - Conversation metadata with status, unread_count, last_message_* fields
- `public.inbox_messages` - Individual messages within conversations (threaded by conversation_id)
- `public.inbox_channel_accounts` - Channel connection status (Email, SMS, WhatsApp)
- `public.contact_handles` - Contact normalization (optional for v1)

### Key Files (Current)
- `src/modules/inbox/pages/UnifiedInboxPage.tsx` - Main inbox page (uses legacy `useMessagesList()`)
- `src/modules/inbox/components/ConversationView.tsx` - Conversation thread display
- `src/modules/inbox/hooks/useMessages.ts` - Legacy React Query hooks
- `src/modules/inbox/api/inbox.api.ts` - Legacy API functions (reads from `messages` table)
- `src/modules/inbox/types/inbox.types.ts` - Legacy `Message` type

### Constraints
- **No destructive changes** - Keep `public.messages` table intact (other modules may use it)
- **Preserve UI layout/styling** - Keep existing design, only change data source
- **DB-only v1** - No external API integrations (Twilio/Gmail) yet
- **Defensive null handling** - Subject, preview, last_message_at may be null
- **Additive-only** - All changes are additive, no breaking changes

---

## Implementation Phases

### Phase 1: Type Definitions & Schema Understanding

**Goal:** Create TypeScript types matching new table schemas and verify DB structure.

#### Task 1.1: Update Inbox Types
**File:** `src/modules/inbox/types/inbox.types.ts`

**Implementation:**
- Add `InboxConversation` interface:
  ```typescript
  export interface InboxConversation {
    id: string;
    channel: 'email' | 'sms' | 'whatsapp';
    primary_handle: string;
    subject: string | null;
    status: 'open' | 'archived' | 'closed';
    unread_count: number;
    last_message_at: string | null;
    last_message_preview: string | null;
    created_at: string;
    updated_at: string;
  }
  ```

- Add `InboxMessage` interface:
  ```typescript
  export interface InboxMessage {
    id: string;
    conversation_id: string;
    channel: 'email' | 'sms' | 'whatsapp';
    direction: 'inbound' | 'outbound';
    from_handle: string;
    to_handle: string;
    body_text: string;
    subject: string | null;
    sent_at: string;
    status: 'sent' | 'delivered' | 'failed';
    created_at: string;
    updated_at: string;
  }
  ```

- Add `InboxChannelAccount` interface:
  ```typescript
  export interface InboxChannelAccount {
    id: string;
    channel: 'email' | 'sms' | 'whatsapp';
    account_identifier: string;
    is_connected: boolean;
    connection_metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
  }
  ```

- Add insert/update types:
  ```typescript
  export type InboxConversationInsert = Omit<InboxConversation, 'id' | 'created_at' | 'updated_at'>;
  export type InboxConversationUpdate = Partial<InboxConversationInsert>;
  export type InboxMessageInsert = Omit<InboxMessage, 'id' | 'created_at' | 'updated_at'>;
  export type InboxChannelAccountInsert = Omit<InboxChannelAccount, 'id' | 'created_at' | 'updated_at'>;
  ```

- Add filter types:
  ```typescript
  export interface ConversationFilters {
    status?: 'open' | 'archived' | 'closed';
    channel?: 'email' | 'sms' | 'whatsapp';
    unread_only?: boolean;
    search?: string;
  }
  ```

**Risk Areas:**
- Schema mismatch if DB columns differ from expected structure
- Null handling must be explicit (many fields nullable)

**Success Criteria:**
- ✅ All types match expected DB schema
- ✅ Nullable fields properly typed as `| null`
- ✅ TypeScript compilation passes
- ✅ Types are exported and importable

---

### Phase 2: API Layer (Conversations)

**Goal:** Create API functions for fetching and updating conversations.

#### Task 2.1: Create Conversations API
**File:** `src/modules/inbox/api/inboxConversations.api.ts` (new file)

**Implementation:**

```typescript
import { supabase } from '@/shared/lib/supabase';
import type { InboxConversation, InboxConversationInsert, InboxConversationUpdate, ConversationFilters } from '../types/inbox.types';

export async function fetchConversations(filters?: ConversationFilters) {
  let query = supabase
    .from('inbox_conversations')
    .select('*');

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
  } else {
    // Default: open conversations only
    query = query.eq('status', 'open');
  }

  if (filters?.channel) {
    if (filters.channel === 'phone') {
      // Map 'phone' to both sms and whatsapp
      query = query.in('channel', ['sms', 'whatsapp']);
    } else {
      query = query.eq('channel', filters.channel);
    }
  }

  if (filters?.unread_only) {
    query = query.gt('unread_count', 0);
  }

  // Search: ILIKE over primary_handle, subject, last_message_preview
  if (filters?.search && filters.search.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;
    query = query.or(
      `primary_handle.ilike.${searchTerm},subject.ilike.${searchTerm},last_message_preview.ilike.${searchTerm}`
    );
  }

  // Sort: last_message_at DESC NULLS LAST, fallback created_at DESC
  query = query
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as InboxConversation[];
}

export async function fetchConversation(id: string) {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as InboxConversation;
}

export async function updateConversation(id: string, updates: InboxConversationUpdate) {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as InboxConversation;
}

export async function markConversationsAsRead(ids: string[]) {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('inbox_conversations')
    .update({ unread_count: 0 })
    .in('id', ids)
    .select();

  if (error) throw error;
  return (data || []) as InboxConversation[];
}

export async function archiveConversations(ids: string[]) {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('inbox_conversations')
    .update({ status: 'archived' })
    .in('id', ids)
    .select();

  if (error) throw error;
  return (data || []) as InboxConversation[];
}
```

**Risk Areas:**
- ILIKE search syntax may need adjustment for Supabase client
- NULLS LAST ordering syntax may differ
- Bulk updates may fail if RLS policies are restrictive

**Success Criteria:**
- ✅ `fetchConversations()` filters correctly (status, channel, unread, search)
- ✅ Search works with ILIKE over multiple columns
- ✅ Sort order: `last_message_at DESC NULLS LAST, created_at DESC`
- ✅ Bulk operations (mark read, archive) work with multiple IDs
- ✅ Null handling prevents crashes

---

### Phase 3: API Layer (Messages)

**Goal:** Create API functions for fetching and creating messages.

#### Task 3.1: Create Messages API
**File:** `src/modules/inbox/api/inboxMessages.api.ts` (new file)

**Implementation:**

```typescript
import { supabase } from '@/shared/lib/supabase';
import type { InboxMessage, InboxMessageInsert } from '../types/inbox.types';

export async function fetchMessagesByConversation(conversationId: string) {
  const { data, error } = await supabase
    .from('inbox_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true });

  if (error) throw error;
  return (data || []) as InboxMessage[];
}

export async function createMessage(message: InboxMessageInsert) {
  const { data, error } = await supabase
    .from('inbox_messages')
    .insert(message)
    .select()
    .single();

  if (error) throw error;
  return data as InboxMessage;
}
```

**Risk Areas:**
- `sent_at` ordering must handle nulls gracefully
- Foreign key constraint on `conversation_id` must be valid

**Success Criteria:**
- ✅ Messages fetched in chronological order (`sent_at ASC`)
- ✅ Message insertion returns created row
- ✅ Null `sent_at` handled gracefully

---

### Phase 4: API Layer (Channel Accounts)

**Goal:** Create API functions for fetching channel connection status.

#### Task 4.1: Create Channel Accounts API
**File:** `src/modules/inbox/api/inboxChannelAccounts.api.ts` (new file)

**Implementation:**

```typescript
import { supabase } from '@/shared/lib/supabase';
import type { InboxChannelAccount } from '../types/inbox.types';

export async function fetchChannelAccounts() {
  const { data, error } = await supabase
    .from('inbox_channel_accounts')
    .select('*')
    .order('channel', { ascending: true });

  if (error) throw error;
  return (data || []) as InboxChannelAccount[];
}
```

**Success Criteria:**
- ✅ Channel accounts fetched successfully
- ✅ Returns empty array if no accounts exist (no crash)

---

### Phase 5: React Query Hooks (Conversations)

**Goal:** Create React Query hooks for conversation data and mutations.

#### Task 5.1: Create Conversations Hooks
**File:** `src/modules/inbox/hooks/useInboxConversations.ts` (new file)

**Implementation:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchConversations,
  fetchConversation,
  updateConversation,
  markConversationsAsRead,
  archiveConversations,
} from '../api/inboxConversations.api';
import type { ConversationFilters } from '../types/inbox.types';

export const inboxKeys = {
  conversations: {
    all: ['inbox', 'conversations'] as const,
    lists: (filters?: ConversationFilters) => ['inbox', 'conversations', 'list', filters] as const,
    detail: (id: string) => ['inbox', 'conversations', id] as const,
  },
  messages: {
    byConversation: (id: string) => ['inbox', 'messages', 'conversation', id] as const,
  },
  channels: {
    all: ['inbox', 'channels'] as const,
  },
};

export function useConversationsList(filters?: ConversationFilters) {
  return useQuery({
    queryKey: inboxKeys.conversations.lists(filters),
    queryFn: () => fetchConversations(filters),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: inboxKeys.conversations.detail(id!),
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => markConversationsAsRead(ids),
    onSuccess: () => {
      // Invalidate all conversation list queries
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
    },
  });
}

export function useArchiveConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => archiveConversations(ids),
    onSuccess: () => {
      // Invalidate all conversation list queries
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
    },
  });
}
```

**Risk Areas:**
- Query key structure must be consistent across all invalidations
- Optimistic updates may conflict with server responses

**Success Criteria:**
- ✅ Hooks handle loading/error states
- ✅ Mutations invalidate relevant queries
- ✅ Enabled logic prevents unnecessary queries (when id is null)

---

### Phase 6: React Query Hooks (Messages & Send Reply)

**Goal:** Create hooks for message threads and send reply mutation.

#### Task 6.1: Create Messages Hooks
**File:** `src/modules/inbox/hooks/useInboxMessages.ts` (new file)

**Implementation:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMessagesByConversation, createMessage } from '../api/inboxMessages.api';
import { fetchConversation, updateConversation } from '../api/inboxConversations.api';
import { inboxKeys } from './useInboxConversations';

export function useMessagesByConversation(conversationId: string | null) {
  return useQuery({
    queryKey: inboxKeys.messages.byConversation(conversationId!),
    queryFn: () => fetchMessagesByConversation(conversationId!),
    enabled: !!conversationId,
  });
}

export function useSendReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, bodyText }: { conversationId: string; bodyText: string }) => {
      // Get conversation to extract channel and primary_handle
      const conversation = await fetchConversation(conversationId);

      // Insert message
      const message = await createMessage({
        conversation_id: conversationId,
        channel: conversation.channel,
        direction: 'outbound',
        from_handle: 'system', // Placeholder for v1
        to_handle: conversation.primary_handle,
        body_text: bodyText.trim(),
        subject: null,
        sent_at: new Date().toISOString(),
        status: 'sent',
      });

      // Update conversation metadata
      await updateConversation(conversationId, {
        last_message_at: message.sent_at,
        last_message_preview: bodyText.trim().substring(0, 120),
        // Do NOT increment unread_count (outbound messages don't count as unread)
      });

      return message;
    },
    onSuccess: (data, variables) => {
      // Invalidate message thread
      queryClient.invalidateQueries({ queryKey: inboxKeys.messages.byConversation(variables.conversationId) });
      // Invalidate conversation list (to update last_message_*)
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
      // Invalidate conversation detail
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.detail(variables.conversationId) });
    },
  });
}
```

**Risk Areas:**
- Transaction logic (insert message + update conversation) not atomic (may need DB function)
- Preview truncation must handle special characters/unicode correctly
- Race conditions if multiple replies sent simultaneously

**Success Criteria:**
- ✅ Message inserted with correct fields
- ✅ Conversation metadata updated (`last_message_at`, `last_message_preview`)
- ✅ `unread_count` not incremented for outbound messages
- ✅ Queries invalidated correctly (thread + list)

---

### Phase 7: React Query Hooks (Channels)

**Goal:** Create hook for channel accounts.

#### Task 7.1: Create Channels Hook
**File:** `src/modules/inbox/hooks/useInboxChannels.ts` (new file)

**Implementation:**

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchChannelAccounts } from '../api/inboxChannelAccounts.api';
import { inboxKeys } from './useInboxConversations';

export function useChannelAccounts() {
  return useQuery({
    queryKey: inboxKeys.channels.all,
    queryFn: fetchChannelAccounts,
  });
}
```

**Success Criteria:**
- ✅ Channel accounts fetched successfully
- ✅ Hook returns empty array if no accounts (no crash)

---

### Phase 8: Utility Functions

**Goal:** Create shared utilities for conversation preview and timestamp formatting.

#### Task 8.1: Create Conversation Utilities
**File:** `src/modules/inbox/utils/conversationUtils.ts` (new file)

**Implementation:**

```typescript
/**
 * Compute preview text from message body (first 120 chars, trimmed)
 * Used for updating conversation.last_message_preview
 */
export function computeMessagePreview(bodyText: string): string {
  return bodyText.trim().substring(0, 120);
}

/**
 * Format timestamp for display (gracefully handle null)
 * Returns "No messages" if timestamp is null/undefined
 */
export function formatConversationTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "No messages";
  
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  
  // Format as relative time (e.g., "2 hours ago") or absolute date
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hour${Math.floor(diffMins / 60) > 1 ? 's' : ''} ago`;
  
  // Fallback to locale date string
  return date.toLocaleDateString();
}

/**
 * Format message sent_at timestamp (gracefully handle null)
 */
export function formatMessageTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "Time unknown";
  
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  
  return date.toLocaleString();
}
```

**Success Criteria:**
- ✅ Preview truncates correctly (120 chars)
- ✅ Timestamp formatting handles nulls gracefully
- ✅ Utilities are exported and testable

---

### Phase 9: Update UnifiedInboxPage (Conversation List)

**Goal:** Replace legacy message list with conversation list.

#### Task 9.1: Update UnifiedInboxPage Component
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Implementation Steps:**

1. **Replace imports:**
   - Remove: `useMessagesList` from `useMessages`
   - Remove: `Message` type import
   - Add: `useConversationsList` from `useInboxConversations`
   - Add: `useMarkAsRead`, `useArchiveConversations` from `useInboxConversations`
   - Add: `InboxConversation` type
   - Add: `formatConversationTimestamp` from `conversationUtils`

2. **Update state:**
   - Change `selectedCommunication` to `selectedConversationId: string | null`
   - Keep `activeTab` and `searchQuery` (filters remain same)

3. **Update data fetching:**
   ```typescript
   // Map tab to filters
   const filters = React.useMemo<ConversationFilters>(() => {
     const base: ConversationFilters = { status: 'open' };
     
     if (activeTab === 'unread') {
       base.unread_only = true;
     } else if (activeTab === 'email') {
       base.channel = 'email';
     } else if (activeTab === 'phone') {
       base.channel = 'phone'; // Maps to sms/whatsapp in API
     }
     
     if (searchQuery.trim()) {
       base.search = searchQuery;
     }
     
     return base;
   }, [activeTab, searchQuery]);

   const { data: conversations, isLoading, isError } = useConversationsList(filters);
   ```

4. **Update conversation list rendering:**
   - Replace `inboxItems` mapping with direct `conversations` array
   - Map `InboxConversation` to list row format:
     - `id`: `conversation.id`
     - `type`: `conversation.channel`
     - `from`: `conversation.primary_handle`
     - `subject`: `conversation.subject || conversation.last_message_preview || ''`
     - `timestamp`: `formatConversationTimestamp(conversation.last_message_at)`
     - Unread indicator: badge if `conversation.unread_count > 0`

5. **Update selection handling:**
   - Change `setSelectedCommunication` to `setSelectedConversationId(conversation.id)`

6. **Wire bulk actions:**
   ```typescript
   const markAsReadMutation = useMarkAsRead();
   const archiveMutation = useArchiveConversations();

   const handleMarkAsRead = () => {
     if (selectedItems.length > 0) {
       markAsReadMutation.mutate(selectedItems as string[]);
       setSelectedItems([]);
     }
   };

   const handleArchive = () => {
     if (selectedItems.length > 0) {
       archiveMutation.mutate(selectedItems as string[]);
       setSelectedItems([]);
     }
   };
   ```

7. **Update button handlers:**
   - "Mark as Read" → `handleMarkAsRead()`
   - "Archive" → `handleArchive()`
   - Enable buttons only when `selectedItems.length > 0`

**Risk Areas:**
- Tab-to-filter mapping must match API expectations
- Search ILIKE may need syntax adjustment
- Selection state type may conflict (`string[]` vs `(string | number)[]`)

**Success Criteria:**
- ✅ Conversation list displays from `inbox_conversations`
- ✅ Tabs filter correctly (All, Unread, Email, Phone)
- ✅ Search works across handle/subject/preview
- ✅ Sort order correct (last_message_at DESC NULLS LAST)
- ✅ Unread badges show when `unread_count > 0`
- ✅ Selection and bulk actions work
- ✅ No crashes on null `subject`/`last_message_preview`/`last_message_at`

---

### Phase 10: Update ConversationView (Message Thread)

**Goal:** Display message thread from `inbox_messages` for selected conversation.

#### Task 10.1: Update ConversationView Component
**File:** `src/modules/inbox/components/ConversationView.tsx`

**Implementation Steps:**

1. **Update props:**
   - Change `communication: InboxCommunication | null` to `conversationId: string | null`
   - Keep interface backward compatible if needed (add new prop alongside old)

2. **Update imports:**
   - Add: `useMessagesByConversation` from `useInboxMessages`
   - Add: `useConversation` from `useInboxConversations`
   - Add: `InboxMessage` type
   - Add: `formatMessageTimestamp` from `conversationUtils`

3. **Update data fetching:**
   ```typescript
   const { data: conversation } = useConversation(conversationId);
   const { data: messages } = useMessagesByConversation(conversationId);
   ```

4. **Update empty state:**
   - Keep existing "Select a message to view conversation" UI
   - Show when `!conversationId || !conversation`

5. **Update message rendering:**
   - Replace `communication.content` with `messages.map(...)`
   - Render message bubbles:
     - `direction='inbound'` → left side, styled as received
     - `direction='outbound'` → right side, styled as sent
   - Display `body_text`, `sent_at` timestamp, `from_handle`/`to_handle`

6. **Auto-scroll to bottom:**
   ```typescript
   const messagesEndRef = React.useRef<HTMLDivElement>(null);

   React.useEffect(() => {
     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
   }, [messages]);
   ```

**Risk Areas:**
- Message sorting must be `sent_at ASC` (already handled in API)
- Null `sent_at` timestamps must be handled gracefully
- Auto-scroll may interfere with user scrolling

**Success Criteria:**
- ✅ Messages display in chronological order
- ✅ Inbound/outbound styling visually distinct
- ✅ Timestamps format correctly (null handling)
- ✅ Auto-scroll works on load/update

---

### Phase 11: Send Reply Integration

**Goal:** Wire reply box to send reply mutation.

#### Task 11.1: Add Reply Box to ConversationView
**File:** `src/modules/inbox/components/ConversationView.tsx`

**Implementation Steps:**

1. **Add reply state:**
   ```typescript
   const [replyText, setReplyText] = useState('');
   const sendReplyMutation = useSendReply();
   ```

2. **Update reply box:**
   - Keep existing `Textarea` and `Send` button
   - Wire `value={replyText}` and `onChange={(e) => setReplyText(e.target.value)}`

3. **Handle send:**
   ```typescript
   const handleSendReply = () => {
     if (!conversationId || !replyText.trim()) return;

     sendReplyMutation.mutate(
       { conversationId, bodyText: replyText },
       {
         onSuccess: () => {
           setReplyText(''); // Clear textarea
           // Auto-scroll handled by messages effect
         },
       }
     );
   };
   ```

4. **Wire button:**
   - `onClick={handleSendReply}`
   - Disable if `!replyText.trim() || sendReplyMutation.isPending`

5. **Optimistic UI (optional):**
   - Show sending state while mutation pending
   - Message appears immediately in thread (via query invalidation)

**Risk Areas:**
- Empty reply validation must prevent empty sends
- Mutation may fail (conversation not found, DB error)
- Textarea clearing may trigger unwanted re-renders

**Success Criteria:**
- ✅ Reply sends and inserts into `inbox_messages`
- ✅ Conversation metadata updates (`last_message_at`, `preview`)
- ✅ Message appears in thread immediately
- ✅ Textarea clears after success
- ✅ Error handling prevents crashes

---

### Phase 12: Channel Connections Card

**Goal:** Display channel connection status.

#### Task 12.1: Create ChannelConnectionsCard Component
**File:** `src/modules/inbox/components/ChannelConnectionsCard.tsx` (new file)

**Implementation:**

```typescript
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Mail, Phone, MessageSquare } from 'lucide-react';
import { useChannelAccounts } from '../hooks/useInboxChannels';

export const ChannelConnectionsCard: React.FC = () => {
  const { data: accounts = [], isLoading } = useChannelAccounts();

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <Phone className="h-4 w-4" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4" />;
      default: return null;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'email': return 'Email';
      case 'sms': return 'SMS';
      case 'whatsapp': return 'WhatsApp';
      default: return channel;
    }
  };

  const isChannelConnected = (channel: string) => {
    const account = accounts.find(a => a.channel === channel);
    return account?.is_connected ?? false;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Communication Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const channels = ['email', 'sms', 'whatsapp'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Communication Channels</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 flex-wrap">
          {channels.map(channel => {
            const connected = isChannelConnected(channel);
            return (
              <Badge
                key={channel}
                variant={connected ? "default" : "outline"}
                className="flex items-center gap-1"
              >
                {getChannelIcon(channel)}
                {getChannelLabel(channel)}
                {connected ? ' ✓' : ''}
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
```

#### Task 12.2: Integrate Card in UnifiedInboxPage
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Implementation:**
- Import `ChannelConnectionsCard`
- Add card above conversation list (or in header area)
- No settings flows yet (display only)

**Success Criteria:**
- ✅ Channel status displays correctly
- ✅ Connected channels show green badge
- ✅ Disconnected channels show outline badge
- ✅ No crashes if accounts missing/null

---

### Phase 13: Remove Legacy Dependencies

**Goal:** Clean up legacy `messages` table usage from inbox module.

#### Task 13.1: Audit Legacy Usage
**Files to check:**
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- `src/modules/inbox/components/ConversationView.tsx`
- `src/modules/inbox/hooks/useMessages.ts` (keep if other modules use)
- `src/modules/inbox/api/inbox.api.ts` (keep if other modules use)

**Implementation:**
- Remove `useMessagesList()` usage from `UnifiedInboxPage`
- Remove `Message` type imports (replace with `InboxConversation`/`InboxMessage`)
- Keep legacy API/hooks files intact (other modules may depend on them)
- Update imports to use new inbox hooks

**Risk Areas:**
- Other modules may depend on legacy `useMessagesList()` hook
- Need to verify no cross-module dependencies

**Success Criteria:**
- ✅ Inbox module no longer reads from `public.messages`
- ✅ All inbox code uses new `inbox_*` tables
- ✅ Other modules still work (if they use legacy APIs)
- ✅ Build passes, TypeScript compiles

---

### Phase 14: Testing & Validation

**Goal:** Manual testing and edge case validation.

#### Task 14.1: Manual Test Checklist

**Test 1: Conversation List**
- [ ] Default filter shows open conversations
- [ ] "All" tab shows all open conversations
- [ ] "Unread" tab shows only conversations with `unread_count > 0`
- [ ] "Email" tab shows only `channel='email'`
- [ ] "Phone" tab shows `channel IN ('sms', 'whatsapp')`
- [ ] Search filters by handle/subject/preview (case-insensitive)
- [ ] Sort order: newest first (by `last_message_at`)
- [ ] Null `last_message_at` falls back to `created_at` for sorting
- [ ] Unread badges appear when `unread_count > 0`

**Test 2: Conversation Thread**
- [ ] Selecting conversation loads messages
- [ ] Messages sorted chronologically (`sent_at ASC`)
- [ ] Inbound messages on left, outbound on right
- [ ] Timestamps format correctly
- [ ] Null `sent_at` shows "Time unknown"
- [ ] Auto-scroll works on load/update

**Test 3: Send Reply**
- [ ] Reply sends and inserts into `inbox_messages`
- [ ] Conversation `last_message_at` updates
- [ ] Conversation `last_message_preview` updates (first 120 chars)
- [ ] `unread_count` does NOT increment for outbound
- [ ] Message appears in thread immediately
- [ ] Textarea clears after success
- [ ] Empty reply prevented (validation)

**Test 4: Mark as Read**
- [ ] Selecting conversations and clicking "Mark as Read" sets `unread_count=0`
- [ ] Unread badges disappear immediately
- [ ] Conversation list refreshes correctly

**Test 5: Archive**
- [ ] Selecting conversations and clicking "Archive" sets `status='archived'`
- [ ] Archived conversations disappear from open list
- [ ] Conversations don't reappear (filtered out)

**Test 6: Channel Connections**
- [ ] Channel status displays from `inbox_channel_accounts`
- [ ] Connected channels show green badge
- [ ] Disconnected channels show outline badge
- [ ] No crashes if accounts table empty

**Test 7: Edge Cases**
- [ ] Null `subject` → fallback to `last_message_preview`
- [ ] Null `last_message_preview` → empty string
- [ ] Null `last_message_at` → "No messages"
- [ ] Empty conversation list → empty state shows
- [ ] No messages in thread → empty thread state
- [ ] Search with no results → empty list
- [ ] Concurrent reply sends → no duplicate messages

**Test 8: Build & Runtime**
- [ ] TypeScript compilation passes
- [ ] No console errors
- [ ] No runtime crashes
- [ ] All queries/mutations work with RLS policies

**Success Criteria:**
- ✅ All manual tests pass
- ✅ No TypeScript errors
- ✅ No runtime crashes
- ✅ Feature works end-to-end

---

## Acceptance Checklist

### Functionality
- ✅ Conversation list displays from `inbox_conversations` (not `messages`)
- ✅ Filters work: All, Unread, Email, Phone
- ✅ Search works: ILIKE over handle/subject/preview
- ✅ Sort order correct: `last_message_at DESC NULLS LAST`
- ✅ Message thread displays from `inbox_messages`
- ✅ Send reply inserts message + updates conversation
- ✅ Mark as Read sets `unread_count=0`
- ✅ Archive sets `status='archived'`
- ✅ Channel connections display status
- ✅ No legacy `messages` table reads in inbox module

### Data Integrity
- ✅ Outbound messages don't increment `unread_count`
- ✅ `last_message_preview` truncated to 120 chars
- ✅ `last_message_at` updated on reply
- ✅ Bulk actions work (multiple IDs)

### UI/UX
- ✅ UI layout/styling unchanged
- ✅ Null handling prevents crashes
- ✅ Empty states display correctly
- ✅ Auto-scroll works
- ✅ Textarea clears after send

### Technical
- ✅ TypeScript compilation passes
- ✅ No runtime errors
- ✅ React Query caching/invalidation correct
- ✅ All queries work with RLS policies

---

## Risk Areas & Mitigation

1. **Schema Mismatch**
   - **Risk:** DB columns differ from expected types
   - **Mitigation:** Verify schema before implementation, adjust types as needed

2. **RLS Policies**
   - **Risk:** Queries fail due to restrictive RLS
   - **Mitigation:** Test queries early, adjust policies if needed

3. **ILIKE Search Syntax**
   - **Risk:** Supabase client may need different syntax
   - **Mitigation:** Test search query early, adjust if needed

4. **Transaction Logic (Send Reply)**
   - **Risk:** Message insert + conversation update not atomic
   - **Mitigation:** Accept eventual consistency for v1; add DB function later if needed

5. **Null Handling**
   - **Risk:** Crashes on null `subject`/`preview`/`timestamp`
   - **Mitigation:** Defensive null checks everywhere, fallbacks in utilities

6. **Legacy Dependencies**
   - **Risk:** Breaking other modules that use legacy `messages` API
   - **Mitigation:** Keep legacy APIs intact, only update inbox module

---

## Estimated Effort

**Total Phases:** 14  
**Total Tasks:** ~20  
**Estimated Complexity:** Medium  
**Estimated Time:** 2-3 days (assuming schema verified)

**High-Risk Phases:**
- Phase 9: UI wiring (complex state management)
- Phase 10: Thread rendering (message mapping, styling)
- Phase 11: Send reply (transaction logic, optimistic updates)

---

## Deliverables

1. **New Type Definitions:**
   - `src/modules/inbox/types/inbox.types.ts` (updated)

2. **New API Files:**
   - `src/modules/inbox/api/inboxConversations.api.ts`
   - `src/modules/inbox/api/inboxMessages.api.ts`
   - `src/modules/inbox/api/inboxChannelAccounts.api.ts`

3. **New Hook Files:**
   - `src/modules/inbox/hooks/useInboxConversations.ts`
   - `src/modules/inbox/hooks/useInboxMessages.ts`
   - `src/modules/inbox/hooks/useInboxChannels.ts`

4. **New Utility File:**
   - `src/modules/inbox/utils/conversationUtils.ts`

5. **Updated Components:**
   - `src/modules/inbox/pages/UnifiedInboxPage.tsx`
   - `src/modules/inbox/components/ConversationView.tsx`
   - `src/modules/inbox/components/ChannelConnectionsCard.tsx` (new)

6. **QA Checklist:**
   - Manual test scenarios documented above

---

**Implementation Plan Version:** 1.0  
**Created:** 2025-01-11  
**Status:** Ready for Implementation
