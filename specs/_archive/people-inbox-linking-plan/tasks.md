# Tasks: People ↔ Inbox Linking (People-first Inbox)

## Task Summary

| # | Task | Type | File | Phase |
|---|------|------|------|-------|
| 1.1 | Create migration for person_id, link_state, link_meta | Create | `supabase/migrations/20260124130000_add_person_link_to_inbox_conversations.sql` | 1 |
| 1.2 | Apply migration locally / verify | Verify | - | 1 |
| 2.1 | Create shared auto-link helper | Create | `supabase/functions/_shared/autoLinkConversation.ts` | 2 |
| 2.2 | Add auto-link to twilio-sms-webhook | Update | `supabase/functions/twilio-sms-webhook/index.ts` | 2 |
| 2.3 | Add auto-link to inbox-gmail-sync | Update | `supabase/functions/inbox-gmail-sync/index.ts` | 2 |
| 3.1 | Extend ConversationFilters and InboxConversation types | Update | `src/modules/inbox/types/inbox.types.ts` | 3 |
| 3.2 | Extend fetchConversations for person_id and unlinked_only | Update | `src/modules/inbox/api/inboxConversations.api.ts` | 3 |
| 3.3 | Add linkConversation and unlinkConversation API | Update | `src/modules/inbox/api/inboxConversations.api.ts` | 3 |
| 3.4 | Add useLinkConversation and useUnlinkConversation hooks | Update | `src/modules/inbox/hooks/useInboxConversations.ts` | 3 |
| 4.1 | Create PeopleSidebar component | Create | `src/modules/inbox/components/PeopleSidebar.tsx` | 4 |
| 4.2 | Add People sidebar to UnifiedInboxPage layout | Update | `src/modules/inbox/pages/UnifiedInboxPage.tsx` | 4 |
| 4.3 | Wire conversation list to person_id / unlinked filter | Update | `src/modules/inbox/pages/UnifiedInboxPage.tsx` | 4 |
| 4.4 | Create LinkConversationModal | Create | `src/modules/inbox/components/LinkConversationModal.tsx` | 4 |
| 4.5 | Add link banner and person display to ConversationView | Update | `src/modules/inbox/components/ConversationView.tsx` | 4 |
| 4.6 | Handle ambiguous state (candidates + choose person) | Update | `src/modules/inbox/components/ConversationView.tsx` | 4 |
| 5.1 | QA: Auto-link email and SMS | Verify | - | 5 |
| 5.2 | QA: Duplicate match → ambiguous banner | Verify | - | 5 |
| 5.3 | QA: Manual link/unlink | Verify | - | 5 |
| 5.4 | QA: Archive behavior unchanged | Verify | - | 5 |

---

## Phase 1: Database Migration

### Task 1.1: Create Migration

**Type:** CREATE  
**File:** `supabase/migrations/20260124130000_add_person_link_to_inbox_conversations.sql`

**Description:** Add person linking columns and indexes to `inbox_conversations`.

**Changes:**
1. `person_id uuid references customers(id) on delete set null`
2. `link_state text not null default 'unlinked' check in ('linked','unlinked','ambiguous')`
3. `link_meta jsonb not null default '{}'::jsonb`
4. Index: `(person_id, last_message_at desc)` where person_id is not null
5. Index: `(link_state, last_message_at desc)`

**Acceptance Criteria:**
- [ ] Migration runs without error
- [ ] Columns exist with correct types and constraints
- [ ] Indexes created
- [ ] Existing rows get defaults

---

### Task 1.2: Apply Migration

**Type:** VERIFY  
**Description:** Run `npx supabase db push` or `supabase migration up` locally; verify app still runs.

**Acceptance Criteria:**
- [ ] Migration applied
- [ ] Build passes
- [ ] No runtime errors from new columns

---

## Phase 2: Auto-link in Edge Functions

### Task 2.1: Create Shared Auto-link Helper

**Type:** CREATE  
**File:** `supabase/functions/_shared/autoLinkConversation.ts`

**Description:** Reusable function to attempt strict auto-link after conversation upsert.

**Signature:**
```typescript
export async function attemptAutoLink(
  supabase: SupabaseClient,
  conversationId: string,
  channel: 'email' | 'sms' | 'whatsapp',
  primaryHandle: string
): Promise<void>
```

**Logic:**
1. Fetch conversation; if `person_id` already set, return (idempotent)
2. Match by channel:
   - `email`: `customers.email = primaryHandle` (exact, trimmed)
   - `sms`|`whatsapp`: `customers.phone = primaryHandle` (exact, E.164)
3. Query `customers` for matches
4. 0 matches → `person_id=null`, `link_state='unlinked'`, `link_meta='{}'`
5. 1 match → `person_id=<id>`, `link_state='linked'`, `link_meta='{}'`
6. >1 matches → `person_id=null`, `link_state='ambiguous'`, `link_meta={ candidates: [ids], matched_on: 'email'|'phone' }`
7. Update `inbox_conversations` where id = conversationId

**Acceptance Criteria:**
- [ ] Idempotent (no-op if already linked)
- [ ] Handles null/empty primaryHandle
- [ ] Handles 0, 1, >1 matches correctly

---

### Task 2.2: Add Auto-link to twilio-sms-webhook

**Type:** UPDATE  
**File:** `supabase/functions/twilio-sms-webhook/index.ts`

**Description:** Call auto-link after conversation find-or-create and before/after final conversation update.

**Insertion point:** After conversation is resolved (existing or new) and message inserted. Call `attemptAutoLink(supabase, conversationId, 'sms', from.trim())` before the final `update` on `inbox_conversations` (around line 144).

**Acceptance Criteria:**
- [ ] Auto-link runs for new and existing SMS conversations
- [ ] Inbound SMS from matching phone auto-links
- [ ] Duplicate phone → ambiguous

---

### Task 2.3: Add Auto-link to inbox-gmail-sync

**Type:** UPDATE  
**File:** `supabase/functions/inbox-gmail-sync/index.ts`

**Description:** Call auto-link after each conversation find-or-create / update.

**Insertion point:** After conversation is created or found (around line 346), and after the conversation update block (around line 424). Call `attemptAutoLink(supabase, conversationId, 'email', primaryHandle)` for each conversation touched. Consider batching: run auto-link once per unique conversationId in the sync loop.

**Acceptance Criteria:**
- [ ] Auto-link runs for new and existing email conversations
- [ ] Inbound email from matching address auto-links
- [ ] Duplicate email → ambiguous

---

## Phase 3: Frontend Data Layer

### Task 3.1: Extend Types

**Type:** UPDATE  
**File:** `src/modules/inbox/types/inbox.types.ts`

**Changes:**
- Add to `InboxConversation`: `person_id`, `link_state`, `link_meta`
- Add to `ConversationFilters`: `person_id?: string | null`, `unlinked_only?: boolean`

**Acceptance Criteria:**
- [ ] Types match DB schema
- [ ] No type errors in consuming code

---

### Task 3.2: Extend fetchConversations

**Type:** UPDATE  
**File:** `src/modules/inbox/api/inboxConversations.api.ts`

**Changes:**
1. If `filters?.person_id` → `query = query.eq('person_id', filters.person_id)`
2. If `filters?.unlinked_only` → `query = query.is('person_id', null)`
3. Preserve existing filters (status, channel, unread_only, search)

**Acceptance Criteria:**
- [ ] person_id filter works
- [ ] unlinked_only filter works
- [ ] Existing filters unchanged

---

### Task 3.3: Add linkConversation and unlinkConversation

**Type:** UPDATE  
**File:** `src/modules/inbox/api/inboxConversations.api.ts`

**Functions:**
```typescript
export async function linkConversation(conversationId: string, personId: string): Promise<InboxConversation>
export async function unlinkConversation(conversationId: string): Promise<InboxConversation>
```

**linkConversation:** `update({ person_id: personId, link_state: 'linked', link_meta: {} })`  
**unlinkConversation:** `update({ person_id: null, link_state: 'unlinked', link_meta: {} })`

**Acceptance Criteria:**
- [ ] Both functions update correctly
- [ ] Return updated conversation

---

### Task 3.4: Add Hooks

**Type:** UPDATE  
**File:** `src/modules/inbox/hooks/useInboxConversations.ts`

**Hooks:**
- `useLinkConversation()` — mutation calling `linkConversation`; invalidate `inboxKeys` on success
- `useUnlinkConversation()` — mutation calling `unlinkConversation`; invalidate `inboxKeys` on success

**Acceptance Criteria:**
- [ ] Mutations invalidate conversation list
- [ ] Optimistic or refetch works

---

## Phase 4: UI Implementation

### Task 4.1: Create PeopleSidebar

**Type:** CREATE  
**File:** `src/modules/inbox/components/PeopleSidebar.tsx`

**Description:** Left sidebar with People list and search.

**Features:**
- Search input (name, email, phone) — client-side filter over `useCustomersList()`
- List of people (scrollable)
- Select person → `onSelectPerson(personId | null)`
- "Unlinked" option at top → `onSelectPerson(null)` to show unlinked conversations
- Highlight selected person

**Acceptance Criteria:**
- [ ] Search filters list
- [ ] Selecting person triggers callback
- [ ] Unlinked option shows unlinked conversations

---

### Task 4.2: Add People Sidebar to Layout

**Type:** UPDATE  
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Changes:**
1. Add state: `selectedPersonId: string | null` (null = Unlinked view)
2. Add PeopleSidebar as left column: `[PeopleSidebar | Conversations list | Message thread]`
3. Pass `selectedPersonId`, `onSelectPerson` to PeopleSidebar

**Acceptance Criteria:**
- [ ] Three-column layout
- [ ] People sidebar visible
- [ ] Selecting person updates state

---

### Task 4.3: Wire Conversation List to Filters

**Type:** UPDATE  
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Changes:**
1. When `selectedPersonId` set → `filters.person_id = selectedPersonId`
2. When `selectedPersonId` null → `filters.unlinked_only = true` (default)
3. Preserve existing tabs (All/Unread/Email/Phone)
4. Combine with status='open'

**Acceptance Criteria:**
- [ ] Default: Unlinked conversations
- [ ] Selecting person: that person's conversations
- [ ] Tabs still filter by channel

---

### Task 4.4: Create LinkConversationModal

**Type:** CREATE  
**File:** `src/modules/inbox/components/LinkConversationModal.tsx`

**Description:** Modal to link a conversation to a person.

**Props:** `open`, `onOpenChange`, `conversationId`, `candidates?: string[]` (for ambiguous), `onLinked`, `onUnlinked`

**Features:**
- Search customers (reuse useCustomersList + filter, or fetchCustomersSearch)
- List of customers to select
- If candidates provided: show "Possible matches" first
- Select → call `linkConversation(conversationId, personId)`
- Unlink button if already linked

**Acceptance Criteria:**
- [ ] Modal opens/closes
- [ ] Search works
- [ ] Select links conversation
- [ ] Unlink works

---

### Task 4.5: Add Link Banner and Person Display to ConversationView

**Type:** UPDATE  
**File:** `src/modules/inbox/components/ConversationView.tsx`

**Changes:**
1. If `person_id` null or `link_state` in ('unlinked','ambiguous') → show banner "Not linked to a person" + "Link person" button
2. If linked → show person display name (`first_name + last_name`; fallback to email/phone)
3. Fetch person via `useCustomer(person_id)` when linked
4. "Link person" opens LinkConversationModal

**Acceptance Criteria:**
- [ ] Banner shows when unlinked/ambiguous
- [ ] Person name shows when linked
- [ ] Link button opens modal

---

### Task 4.6: Handle Ambiguous State

**Type:** UPDATE  
**File:** `src/modules/inbox/components/ConversationView.tsx`

**Changes:**
1. If `link_state === 'ambiguous'` → show "Choose person" banner with candidate list
2. Fetch customers by `link_meta.candidates` IDs
3. Allow selecting from candidates or searching and picking different person
4. Pass `candidates` to LinkConversationModal

**Acceptance Criteria:**
- [ ] Ambiguous shows "Choose person" with candidates
- [ ] Selecting candidate links and resolves ambiguous
- [ ] Can search and pick different person

---

## Phase 5: QA

### Task 5.1: Auto-link Email and SMS

- Create customer with email X and phone Y
- Receive inbound email from X → conversation auto-links
- Receive inbound SMS from Y → conversation auto-links

### Task 5.2: Duplicate Match → Ambiguous

- Create two customers with same phone
- Receive inbound SMS from that phone → ambiguous banner with candidates

### Task 5.3: Manual Link/Unlink

- Manual link resolves ambiguous
- Unlink returns conversation to Unlinked view
- Link moves conversation under selected person

### Task 5.4: Archive Unchanged

- Archive still works (status changes)
- Archived conversations respect existing filters

---

## Commit Plan

1. **Commit 1:** Migration (`20260124130000_add_person_link_to_inbox_conversations.sql`)
2. **Commit 2:** Edge functions auto-link (`_shared/autoLinkConversation.ts`, twilio-sms-webhook, inbox-gmail-sync)
3. **Commit 3:** Frontend filters + sidebar (types, API, hooks, PeopleSidebar, UnifiedInboxPage layout + filters)
4. **Commit 4:** Link modal + ambiguous handling + polish (LinkConversationModal, ConversationView updates)

---

## Progress Tracking

**Phase 1: Database Migration**
- [X] Task 1.1: Create migration
- [ ] Task 1.2: Apply migration

**Phase 2: Auto-link in Edge Functions**
- [X] Task 2.1: Create shared auto-link helper
- [X] Task 2.2: Add auto-link to twilio-sms-webhook
- [X] Task 2.3: Add auto-link to inbox-gmail-sync

**Phase 3: Frontend Data Layer**
- [X] Task 3.1: Extend types
- [X] Task 3.2: Extend fetchConversations
- [X] Task 3.3: Add linkConversation and unlinkConversation
- [X] Task 3.4: Add hooks

**Phase 4: UI Implementation**
- [X] Task 4.1: Create PeopleSidebar
- [X] Task 4.2: Add People sidebar to layout
- [X] Task 4.3: Wire conversation list to filters
- [X] Task 4.4: Create LinkConversationModal
- [X] Task 4.5: Add link banner and person display
- [X] Task 4.6: Handle ambiguous state

**Phase 5: QA**
- [ ] Task 5.1: Auto-link email and SMS
- [ ] Task 5.2: Duplicate match → ambiguous
- [ ] Task 5.3: Manual link/unlink
- [ ] Task 5.4: Archive unchanged
