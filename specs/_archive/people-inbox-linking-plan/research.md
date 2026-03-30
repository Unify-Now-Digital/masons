# Research: People ↔ Inbox Linking (People-first Inbox)

## Phase 0 — Locate the Real Files (No Assumptions)

### 1. Unified Inbox Page Component

| Search | Result |
|--------|--------|
| "Unified Inbox" | `src/modules/inbox/pages/UnifiedInboxPage.tsx` (line 97) |
| "Manage conversations from all channels" | Same file (line 99) |
| Route path | `src/app/router.tsx` line 25: `<Route path="inbox" element={<UnifiedInboxPage />} />` |
| Full URL | `/dashboard/inbox` (from AppSidebar: `url: "/dashboard/inbox"`) |

**Exact file paths:**
- **Main Inbox page:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- **Router:** `src/app/router.tsx`
- **Sidebar nav:** `src/app/layout/AppSidebar.tsx`

---

### 2. API / Data Access Layer

| Search | Result |
|--------|--------|
| `inbox_conversations` | `src/modules/inbox/api/inboxConversations.api.ts` — all queries |
| `archiveConversations` | Same file (lines 83–94) |
| `fetchConversations` | Same file (lines 4–45) |
| `updateConversation` | Same file (lines 58–68) |

**Exact file:** `src/modules/inbox/api/inboxConversations.api.ts`

**Functions:**
- `fetchConversations(filters?: ConversationFilters)` — direct Supabase `.from('inbox_conversations').select('*')`
- `fetchConversation(id)` — direct Supabase `.eq('id', id).single()`
- `updateConversation(id, updates)` — direct Supabase `.update(updates).eq('id', id)`
- `markConversationsAsRead(ids)` — direct Supabase update
- `archiveConversations(ids)` — direct Supabase `.update({ status: 'archived' })`

**Write path: Direct Supabase client** (no Edge Functions for archive/read/link). Link and unlink will use the same pattern.

---

### 3. People (Customers) Data Access

| Search | Result |
|--------|--------|
| `from('customers')` | `src/modules/customers/hooks/useCustomers.ts` |
| People list/search | `useCustomersList()` — fetches all; no server-side search |
| Search logic | Client-side in `CustomersPage.tsx` — filters by name/email/phone |

**Exact files:**
- **Customers API/hooks:** `src/modules/customers/hooks/useCustomers.ts`
- **Customers page:** `src/modules/customers/pages/CustomersPage.tsx`

**Reusable pieces:**
- `useCustomersList()` — returns all customers (for People sidebar + link modal)
- `fetchCustomer(id)` — for single customer (header display)
- Search: **client-side only** — `CustomersPage` filters `uiCustomers` by `searchQuery` over `firstName`, `lastName`, `email`, `phone`. Inbox People sidebar can reuse same pattern: fetch all, filter client-side. Alternatively, add `fetchCustomersSearch(query)` with `.or()` ILIKE for server-side search if list grows large.

**Customer type:** `Customer` in `useCustomers.ts` — `id`, `first_name`, `last_name`, `email`, `phone`, `address`, `city`, `country`, `created_at`, `updated_at`

---

### 4. Edge Functions (Ingestion Paths for Auto-link)

| Function | Path | Creates/updates conversation? |
|----------|------|-------------------------------|
| SMS inbound | `supabase/functions/twilio-sms-webhook/index.ts` | Yes — find-or-create by `external_thread_id` |
| Gmail inbound | `supabase/functions/inbox-gmail-sync/index.ts` | Yes — find-or-create by Gmail `threadId` |
| WhatsApp inbound | **Not found** | N/A — no dedicated webhook |

**twilio-sms-webhook:** Lines 62–95 — finds or creates conversation. Lines 144–147 — updates `last_message_*`, `unread_count`. **Auto-link insertion point:** After conversation upsert (after line 95 for new, after line 71 for existing) and before/after the final update (lines 144–147).

**inbox-gmail-sync:** Lines 321–346 — finds or creates conversation. Lines 394–424 — updates conversation metadata. **Auto-link insertion point:** After conversation find-or-create (line 346) and ideally after message insert + conversation update (around line 424) — or run auto-link once per conversation touched in the sync batch.

**Shared module:** No `supabase/functions/_shared` folder exists. Options: (1) Create `_shared/autoLinkConversation.ts` and import from both functions, or (2) Inline auto-link logic in each function. Plan recommends shared module for DRY and consistency.

---

### 5. Conversation View (Header / Right Panel)

**File:** `src/modules/inbox/components/ConversationView.tsx`

- Uses `useConversation(conversationId)` for conversation data
- Uses `useMessagesByConversation`, `useSendReply` for messages
- **Link banner / person display:** Add here (conversation header area)

---

### 6. Types

**File:** `src/modules/inbox/types/inbox.types.ts`

- `InboxConversation` — extend with `person_id`, `link_state`, `link_meta`
- `ConversationFilters` — extend with `person_id`, `unlinked_only` (or equivalent)

---

### 7. Confirmed Summary

| Deliverable | Action | Exact Path |
|-------------|--------|------------|
| Migration | Create | `supabase/migrations/20260124130000_add_person_link_to_inbox_conversations.sql` |
| Auto-link (SMS) | Update | `supabase/functions/twilio-sms-webhook/index.ts` |
| Auto-link (Gmail) | Update | `supabase/functions/inbox-gmail-sync/index.ts` |
| Link/Unlink API | Update | `src/modules/inbox/api/inboxConversations.api.ts` |
| Conversation filters | Update | `src/modules/inbox/api/inboxConversations.api.ts` + `inbox.types.ts` |
| People sidebar | Create | `src/modules/inbox/components/PeopleSidebar.tsx` (or similar) |
| Inbox layout | Update | `src/modules/inbox/pages/UnifiedInboxPage.tsx` |
| Conversation header | Update | `src/modules/inbox/components/ConversationView.tsx` |
| Link modal | Create | `src/modules/inbox/components/LinkConversationModal.tsx` |
| Types | Update | `src/modules/inbox/types/inbox.types.ts` |
| Customers fetch (search) | Extend or reuse | `src/modules/customers/hooks/useCustomers.ts` or inline in Inbox |

---

## Technical Decisions

### People Search Strategy

**Decision:** Reuse `useCustomersList()` with client-side filter (initially)

**Rationale:** Customers list is typically small (<500). Client-side filter over name/email/phone is sufficient for MVP. Can add `fetchCustomersSearch(query)` with `.or()` ILIKE later if needed.

---

### Write Path for Link/Unlink

**Decision:** Direct Supabase client (same as archive)

**Rationale:** Archive uses `updateConversation` / direct `.update()`. No Edge Function. Link/unlink are simple updates; no external API or secret needed. Follow existing pattern.

---

### Auto-link Shared vs Inline

**Decision:** Create `supabase/functions/_shared/autoLinkConversation.ts`

**Rationale:** Same logic in two Edge Functions. Shared module avoids duplication and keeps behavior identical. Deno imports: `import { attemptAutoLink } from '../_shared/autoLinkConversation.ts';`

---

## Progress Tracking

- [X] Phase 0: Discovery complete — all file paths and patterns confirmed
