# Make Unified Inbox Module Functional Using Supabase Tables

## Overview

**Goal:** Replace all dummy/legacy Inbox data sources with new Supabase-backed tables to create a fully functional, DB-backed unified inbox v1. The inbox will aggregate conversations from multiple channels (Email, SMS, WhatsApp) into a single, searchable interface.

**Context:**
- Current inbox implementation uses legacy `public.messages` table with read-only functionality
- New tables (`inbox_conversations`, `inbox_messages`, `inbox_channel_accounts`, `contact_handles`) are being introduced for proper conversation threading and multi-channel support
- External integrations (Twilio, Gmail API) are out of scope for v1; focus is on DB-backed functionality
- Existing UI layout and styling will be preserved (list → details → conversation → reply box)

**Scope:**
- Replace all data sources from `public.messages` to `inbox_*` tables
- Implement conversation list with filtering, search, and sorting
- Implement conversation thread view with message history
- Implement basic actions: mark as read, archive, send reply (DB-only)
- Display channel connection status from `inbox_channel_accounts`
- No external API integrations yet (Twilio/Gmail will come later)

---

## Current State Analysis

### Legacy Messages Table

**Table:** `public.messages`

**Current Structure:**
- `id` (UUID, primary key)
- `order_id` (UUID, nullable, FK to orders)
- `company_id` (UUID, nullable)
- `thread_id` (text, nullable)
- `type` ('email' | 'phone' | 'note' | 'internal')
- `direction` ('inbound' | 'outbound')
- `from_name`, `from_email`, `from_phone` (text, nullable)
- `subject` (text, nullable)
- `content` (text)
- `is_read` (boolean)
- `priority` ('low' | 'medium' | 'high')
- `created_at`, `updated_at` (timestamptz)

**Current Usage:**
- `UnifiedInboxPage` reads from `messages` via `useMessagesList()`
- Displays flat list of messages (no conversation grouping)
- Read-only view (no reply functionality)
- No filtering by channel or status

**Observations:**
- No conversation-centric grouping (messages are flat)
- No `unread_count` aggregation per conversation
- No `last_message_at` or `last_message_preview` for list efficiency
- No `status` field for archiving/conversation lifecycle
- No channel account management

### New Inbox Tables

**Table 1:** `public.inbox_conversations`
- Purpose: Group messages into threaded conversations with metadata
- Key fields (expected):
  - `id` (UUID, primary key)
  - `channel` ('email' | 'sms' | 'whatsapp')
  - `primary_handle` (text) - main contact identifier (email/phone)
  - `subject` (text, nullable) - conversation subject
  - `status` ('open' | 'archived' | 'closed')
  - `unread_count` (integer, default 0)
  - `last_message_at` (timestamptz, nullable)
  - `last_message_preview` (text, nullable) - first 120 chars
  - `created_at`, `updated_at` (timestamptz)

**Table 2:** `public.inbox_messages`
- Purpose: Individual messages within conversations
- Key fields (expected):
  - `id` (UUID, primary key)
  - `conversation_id` (UUID, FK to inbox_conversations)
  - `channel` ('email' | 'sms' | 'whatsapp')
  - `direction` ('inbound' | 'outbound')
  - `from_handle` (text) - sender identifier
  - `to_handle` (text) - recipient identifier
  - `body_text` (text) - message content
  - `subject` (text, nullable) - message subject (for email)
  - `sent_at` (timestamptz) - message timestamp
  - `status` ('sent' | 'delivered' | 'failed', default 'sent')
  - `created_at`, `updated_at` (timestamptz)

**Table 3:** `public.inbox_channel_accounts`
- Purpose: Manage connected channel accounts (Email, SMS, WhatsApp)
- Key fields (expected):
  - `id` (UUID, primary key)
  - `channel` ('email' | 'sms' | 'whatsapp')
  - `account_identifier` (text) - email/phone number
  - `is_connected` (boolean, default false)
  - `connection_metadata` (jsonb, nullable) - OAuth tokens, API keys, etc.
  - `created_at`, `updated_at` (timestamptz)

**Table 4:** `public.contact_handles`
- Purpose: Normalize contact identifiers across channels
- Key fields (expected):
  - `id` (UUID, primary key)
  - `handle` (text, unique) - email/phone number
  - `handle_type` ('email' | 'phone')
  - `display_name` (text, nullable)
  - `created_at`, `updated_at` (timestamptz)

**Observations:**
- New schema is conversation-centric (better UX for threading)
- Supports multiple channels with unified interface
- `unread_count` aggregation reduces N+1 queries
- `last_message_preview` enables efficient list rendering
- `status` field enables archiving workflow

---

## Implementation Approach

### Phase 1: Type Definitions & API Layer

**Goal:** Create TypeScript types and API functions for new inbox tables.

**Tasks:**
1. Create/update `src/modules/inbox/types/inbox.types.ts`:
   - Add `InboxConversation` interface (matches DB schema)
   - Add `InboxMessage` interface
   - Add `InboxChannelAccount` interface
   - Add `ContactHandle` interface (optional, for future use)
   - Add insert/update types for each

2. Create `src/modules/inbox/api/inboxConversations.api.ts`:
   - `fetchConversations(filters)` - list with filters (status, channel, search)
   - `fetchConversation(id)` - single conversation detail
   - `updateConversation(id, updates)` - update (status, unread_count)
   - `markConversationsAsRead(ids)` - bulk mark as read
   - `archiveConversations(ids)` - bulk archive

3. Create `src/modules/inbox/api/inboxMessages.api.ts`:
   - `fetchMessagesByConversation(conversationId)` - thread messages
   - `createMessage(message)` - insert new message
   - Ensure `sent_at`, `direction`, `channel` are set correctly

4. Create `src/modules/inbox/api/inboxChannelAccounts.api.ts`:
   - `fetchChannelAccounts()` - list all accounts
   - `fetchChannelAccountByChannel(channel)` - single account

**Success Criteria:**
- All types match DB schema
- API functions use correct table names and column names
- Null handling is defensive (subject, preview, last_message_at)

---

### Phase 2: React Query Hooks

**Goal:** Create React Query hooks for data fetching and mutations.

**Tasks:**
1. Create `src/modules/inbox/hooks/useInboxConversations.ts`:
   - `useConversationsList(filters)` - query with filters
   - `useConversation(id)` - single conversation query
   - `useMarkAsRead()` - mutation to set unread_count=0
   - `useArchiveConversations()` - mutation to set status='archived'

2. Create `src/modules/inbox/hooks/useInboxMessages.ts`:
   - `useMessagesByConversation(conversationId)` - thread query
   - `useSendReply()` - mutation to create message + update conversation

3. Create `src/modules/inbox/hooks/useInboxChannels.ts`:
   - `useChannelAccounts()` - list channel accounts

**Query Keys Structure:**
```typescript
export const inboxKeys = {
  conversations: {
    all: ['inbox', 'conversations'] as const,
    lists: (filters: ConversationFilters) => ['inbox', 'conversations', 'list', filters] as const,
    detail: (id: string) => ['inbox', 'conversations', id] as const,
  },
  messages: {
    byConversation: (id: string) => ['inbox', 'messages', 'conversation', id] as const,
  },
  channels: {
    all: ['inbox', 'channels'] as const,
  },
};
```

**Success Criteria:**
- Hooks handle loading/error states
- Mutations invalidate relevant queries
- Optimistic updates where appropriate

---

### Phase 3: Conversation List UI (Left Panel)

**Goal:** Replace legacy message list with conversation list using new tables.

**Tasks:**
1. Update `UnifiedInboxPage.tsx`:
   - Replace `useMessagesList()` with `useConversationsList(filters)`
   - Implement filter state:
     - Tab: 'all' | 'unread' | 'email' | 'phone'
     - Search: text input for ILIKE filtering
   - Map filters to API:
     - 'all': status='open'
     - 'unread': status='open' AND unread_count > 0
     - 'email': channel='email' AND status='open'
     - 'phone': channel IN ('sms','whatsapp') AND status='open'
   - Search: ILIKE over `primary_handle`, `subject`, `last_message_preview`

2. Conversation list rendering:
   - Sort: `last_message_at DESC NULLS LAST, created_at DESC`
   - Row display:
     - Sender/handle: `primary_handle`
     - Subject/preview: `subject` or `last_message_preview` (fallback)
     - Channel icon: email/phone/sms/whatsapp
     - Unread indicator: badge if `unread_count > 0`
     - Timestamp: `last_message_at` (gracefully handle null)

3. Selection handling:
   - Track `selectedConversationId` state
   - Pass to `ConversationView` component

**Success Criteria:**
- List shows conversations (not flat messages)
- Tabs filter correctly
- Search works across handle/subject/preview
- Sort order is correct
- Null handling prevents crashes

---

### Phase 4: Conversation Thread UI (Right Panel)

**Goal:** Display message thread for selected conversation.

**Tasks:**
1. Update `ConversationView.tsx`:
   - Replace message thread source with `useMessagesByConversation(conversationId)`
   - Sort messages: `sent_at ASC`
   - Message bubble rendering:
     - `direction='inbound'` → left side, styled for received
     - `direction='outbound'` → right side, styled for sent
   - Display `sent_at` timestamps (gracefully handle null)
   - Auto-scroll to bottom on load/update

2. Reply box integration:
   - Textarea for reply input
   - "Send Reply" button triggers `useSendReply()` mutation
   - Clear textarea after success
   - Scroll to bottom after send

**Success Criteria:**
- Messages display in chronological order
- Inbound/outbound styling is visually distinct
- Timestamps format correctly
- Reply sends and appears in thread

---

### Phase 5: Send Reply Action

**Goal:** Implement DB-only reply functionality.

**Tasks:**
1. Implement `useSendReply()` mutation logic:
   - Input: `conversationId`, `bodyText`
   - Validation: trim bodyText, reject empty
   - Insert `inbox_messages` row:
     - `conversation_id` = selected conversation
     - `channel` = conversation.channel
     - `direction` = 'outbound'
     - `sent_at` = `now()`
     - `from_handle` = 'system' (placeholder for v1)
     - `to_handle` = conversation.primary_handle
     - `body_text` = trimmed textarea content
     - `status` = 'sent' (DB-only placeholder)

2. After message insert, update `inbox_conversations`:
   - `last_message_at` = `sent_at` (from inserted message)
   - `last_message_preview` = first 120 chars of `body_text`
   - Do NOT increment `unread_count` (outbound messages don't count as unread)

3. Optimistic UI updates:
   - Show message immediately in thread (before server response)
   - Update conversation list item (last_message_at/preview)
   - Clear textarea on success

**Success Criteria:**
- Reply inserts correctly
- Conversation metadata updates (last_message_at, preview)
- Unread count unaffected by outbound
- UI updates optimistically

---

### Phase 6: Mark as Read & Archive Actions

**Goal:** Implement bulk actions for conversations.

**Tasks:**
1. Mark as Read action:
   - Use `useMarkAsRead()` mutation
   - Update selected conversations: `unread_count = 0`
   - Optimistic UI: remove unread indicators immediately
   - Invalidate conversation list queries

2. Archive action:
   - Use `useArchiveConversations()` mutation
   - Update selected conversations: `status = 'archived'`
   - Optimistic UI: remove from list immediately (filtered out)
   - Invalidate conversation list queries

3. Button integration in `UnifiedInboxPage.tsx`:
   - "Mark as Read" button enabled when conversations selected
   - "Archive" button enabled when conversations selected
   - Both trigger mutations with selected IDs

**Success Criteria:**
- Bulk actions work on multiple selections
- UI updates optimistically
- Queries invalidate correctly
- Filtered conversations don't reappear (archived filtered out)

---

### Phase 7: Channel Connection Display

**Goal:** Show channel connection status from `inbox_channel_accounts`.

**Tasks:**
1. Create `ChannelConnectionsCard` component:
   - Fetch channel accounts via `useChannelAccounts()`
   - Display buttons: Email / Call / WhatsApp
   - "Connected" state based on `is_connected`
   - Styling: green badge for connected, gray for disconnected

2. Integration in `UnifiedInboxPage`:
   - Place card above conversation list (or in header area)
   - No settings flows yet (display only)

**Success Criteria:**
- Connection status displays correctly
- Channel buttons render for all channels
- No errors when `is_connected` is null/undefined

---

### Phase 8: Remove Legacy Dependencies

**Goal:** Clean up legacy `messages` table usage from inbox module.

**Tasks:**
1. Remove `fetchMessages()` from `inbox.api.ts` (or mark deprecated)
2. Remove `useMessagesList()` usage from `UnifiedInboxPage`
3. Keep legacy API/hooks for backward compatibility if other modules use them
4. Update imports to use new inbox hooks

**Success Criteria:**
- Inbox module no longer reads from `public.messages`
- Other modules (if any) still work with legacy APIs
- No breaking changes to unrelated features

---

## Data Access Patterns

### Conversation List Query

**Base Query:**
```sql
SELECT *
FROM inbox_conversations
WHERE status = 'open'
ORDER BY last_message_at DESC NULLS LAST, created_at DESC;
```

**With Filters:**
- Unread: `WHERE status = 'open' AND unread_count > 0`
- Email: `WHERE channel = 'email' AND status = 'open'`
- Phone: `WHERE channel IN ('sms', 'whatsapp') AND status = 'open'`

**With Search:**
```sql
WHERE status = 'open'
  AND (
    primary_handle ILIKE '%search%'
    OR subject ILIKE '%search%'
    OR last_message_preview ILIKE '%search%'
  )
```

### Message Thread Query

```sql
SELECT *
FROM inbox_messages
WHERE conversation_id = $1
ORDER BY sent_at ASC;
```

### Send Reply Transaction

1. Insert message:
```sql
INSERT INTO inbox_messages (conversation_id, channel, direction, from_handle, to_handle, body_text, sent_at, status)
VALUES ($1, $2, 'outbound', 'system', $3, $4, now(), 'sent')
RETURNING id, sent_at;
```

2. Update conversation:
```sql
UPDATE inbox_conversations
SET last_message_at = $1,
    last_message_preview = LEFT($2, 120),
    updated_at = now()
WHERE id = $3;
```

---

## Safety Considerations

### Null Handling

**Defensive checks required:**
- `subject` (nullable) → display fallback to `last_message_preview`
- `last_message_preview` (nullable) → display fallback to empty string
- `last_message_at` (nullable) → sort fallback to `created_at`, display fallback to "No messages"
- `sent_at` (nullable) → display fallback to "Time unknown"

### Data Integrity

- `unread_count` must be non-negative (add check constraint if not exists)
- `status` must be one of ('open', 'archived', 'closed') (add check constraint if not exists)
- `channel` must be one of ('email', 'sms', 'whatsapp') (add check constraint if not exists)

### Migration Strategy

- **Additive-only approach**: No destructive changes to existing tables
- **Legacy table preserved**: `public.messages` remains untouched (other modules may depend on it)
- **Gradual migration**: Only inbox module uses new tables; other features unchanged

---

## What NOT to Do

- ❌ **Do NOT delete or modify `public.messages` table** - other modules may still use it
- ❌ **Do NOT implement external API integrations** (Twilio/Gmail) - v1 is DB-only
- ❌ **Do NOT change UI layout/styling** - preserve existing design
- ❌ **Do NOT implement channel connection settings flows** - display status only
- ❌ **Do NOT add complex business logic** - keep it simple for v1
- ❌ **Do NOT implement message attachments** - text-only for v1
- ❌ **Do NOT implement read receipts or delivery status UI** - DB-only status='sent' is placeholder

---

## Open Questions / Considerations

1. **Table Schema Verification**: Are the expected column names/types correct? Need to verify actual DB schema before implementation.

2. **RLS Policies**: Do `inbox_*` tables have RLS enabled? What are the access policies? Need to ensure queries work with authenticated user.

3. **Channel Mapping**: Current UI has "Phone" tab - should this map to both 'sms' and 'whatsapp', or separate tabs? Decision: Use single "Phone" tab for now, map to IN ('sms', 'whatsapp').

4. **Contact Handle Normalization**: Should `primary_handle` be normalized via `contact_handles` table, or store directly? Decision: Store directly in v1, normalize later if needed.

5. **Message Threading**: Do we need `thread_id` in `inbox_messages` if already grouped by `conversation_id`? Likely redundant, but verify.

6. **Unread Count Sync**: Should `unread_count` be a computed column or maintained via triggers? Decision: Maintained via application logic for v1; triggers can be added later for efficiency.

7. **Search Performance**: ILIKE over multiple columns may be slow. Consider adding GIN indexes on text fields if performance degrades.

---

## Acceptance Criteria

✅ **Conversation List:**
- Displays conversations (not flat messages) from `inbox_conversations`
- Default filter shows open conversations
- Tabs filter correctly (All, Unread, Email, Phone)
- Search works across handle/subject/preview
- Sort order: last_message_at DESC, created_at DESC
- Null handling prevents crashes

✅ **Conversation Thread:**
- Displays messages from `inbox_messages` for selected conversation
- Messages sorted chronologically (sent_at ASC)
- Inbound/outbound styling is visually distinct
- Timestamps display correctly (null handling)

✅ **Send Reply:**
- Inserts message into `inbox_messages`
- Updates conversation (`last_message_at`, `last_message_preview`)
- Does not increment `unread_count`
- UI updates optimistically
- Textarea clears after success

✅ **Mark as Read:**
- Sets `unread_count = 0` for selected conversations
- UI updates optimistically
- Unread indicators disappear

✅ **Archive:**
- Sets `status = 'archived'` for selected conversations
- Conversations disappear from open list
- UI updates optimistically

✅ **Channel Connections:**
- Displays connection status from `inbox_channel_accounts`
- Shows Email/Call/WhatsApp buttons with connected state
- No crashes if accounts missing/null

✅ **No Legacy Dependencies:**
- Inbox module no longer reads from `public.messages`
- Build passes, TypeScript compiles
- No runtime errors

---

## Deliverables

1. **Updated TypeScript Types:**
   - `src/modules/inbox/types/inbox.types.ts` - new conversation/message types

2. **New API Layer:**
   - `src/modules/inbox/api/inboxConversations.api.ts`
   - `src/modules/inbox/api/inboxMessages.api.ts`
   - `src/modules/inbox/api/inboxChannelAccounts.api.ts`

3. **New React Query Hooks:**
   - `src/modules/inbox/hooks/useInboxConversations.ts`
   - `src/modules/inbox/hooks/useInboxMessages.ts`
   - `src/modules/inbox/hooks/useInboxChannels.ts`

4. **Updated Components:**
   - `src/modules/inbox/pages/UnifiedInboxPage.tsx` - conversation list
   - `src/modules/inbox/components/ConversationView.tsx` - message thread
   - `src/modules/inbox/components/ChannelConnectionsCard.tsx` (new)

5. **QA Checklist:**
   - Manual test scenarios for all features
   - Edge case testing (nulls, empty states, bulk actions)

---

**Specification Version:** 1.0  
**Created:** 2025-01-11  
**Status:** Ready for Implementation
