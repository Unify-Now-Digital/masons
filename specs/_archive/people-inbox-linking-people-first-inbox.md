# People ↔ Unified Inbox Linking (People-first Inbox)

## Overview

**Goal:** Link inbox conversations to People records (customers) with strict matching and manual linking. Deliver a People-first Inbox UX: select a Person from a sidebar to view their conversations; default to Unlinked conversations when no person is selected.

**User decisions (authoritative):**
- One People record → multiple conversations (keep separate conversations per channel/thread)
- Auto-link + manual link supported
- **Strict match only** (exact equality)
- Phone numbers stored as E.164; match exactly
- If duplicates match → show "Choose person" banner (ambiguous state)
- Keep conversations separate per channel; allow filtering by person
- Inbox UX is **People-first**: select a Person to view their conversations
- Add **Unlinked** conversations view
- Display person info from People (no denormalized snapshots); updates reflect People changes
- No backfill required (test messages only)
- Linking permission: any staff (no auth yet)

---

## Context

### Inbox tables
- `inbox_conversations`, `inbox_messages`, `inbox_channel_accounts`
- Channels: `email` (Gmail), `whatsapp` (Twilio), `sms` (Twilio)
- Archiving: `inbox_conversations.status` (not `is_archived`). UI filters `status='open'`.

### People (customers) table
- `public.customers`
- Columns: `id` (uuid), `first_name`, `last_name`, `email`, `phone` (E.164)

---

## Discovery Findings

### Inbox page & state
- **Main page:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- **State:** `activeTab` (all | email | phone | unread), `searchQuery`, `selectedItems`, `selectedConversationId`
- **Filters:** `ConversationFilters` in `inbox.types.ts` — `status`, `channel` (phone → sms/whatsapp), `unread_only`, `search`

### Conversation list & API
- **API:** `src/modules/inbox/api/inboxConversations.api.ts`
  - `fetchConversations(filters)` — direct Supabase; filters `status`, `channel`, `search`
  - `archiveConversations(ids)` — direct Supabase `update({ status: 'archived' })`
  - `updateConversation(id, updates)` — direct Supabase update
- **Write path:** **Direct Supabase client** (no Edge Functions for archive/read). Follow this for link/unlink.

### Edge Functions (ingestion paths for auto-link)
- **SMS inbound:** `supabase/functions/twilio-sms-webhook/index.ts` — creates/updates conversations
- **Gmail inbound:** `supabase/functions/inbox-gmail-sync/index.ts` — creates/updates conversations
- **WhatsApp inbound:** No dedicated webhook found. If Twilio WhatsApp webhook exists elsewhere or is added, include auto-link there. Otherwise, add `twilio-whatsapp-webhook` when WhatsApp inbound is implemented.

### Channel filter
- Phone tab → `channel: 'phone'` → API maps to `IN ('sms', 'whatsapp')` ✓

### Archive
- `status = 'archived'` via direct Supabase update ✓

---

## Database Changes

### Migration

Add columns to `public.inbox_conversations`:

| Column       | Type       | Nullable | Default   | Constraint |
|-------------|------------|----------|-----------|------------|
| `person_id` | uuid       | yes      | null      | FK → `public.customers(id)` ON DELETE SET NULL |
| `link_state`| text       | no       | 'unlinked'| CHECK IN ('linked','unlinked','ambiguous') |
| `link_meta` | jsonb      | no       | '{}'      | - |

**link_meta:** Store candidates for ambiguous matching: `{ candidates: [uuid,...], matched_on: 'email'|'phone' }`

**Indexes:**
- `(person_id, last_message_at DESC)` — fast per-person conversation list
- `(link_state, last_message_at DESC)` — fast Unlinked / ambiguous filters

**Migration SQL (outline):**
1. `ALTER TABLE inbox_conversations ADD COLUMN person_id ...`
2. `ADD COLUMN link_state ... DEFAULT 'unlinked'`
3. `ADD COLUMN link_meta ... DEFAULT '{}'`
4. `CREATE INDEX ... ON inbox_conversations (person_id, last_message_at DESC)`
5. `CREATE INDEX ... ON inbox_conversations (link_state, last_message_at DESC)`

**Compatibility:** Existing code must work when `person_id` is null. All new columns nullable or have defaults.

---

## Auto-linking Rules (Strict)

When a conversation is created or updated by channel ingestion:

1. If `person_id` already set → do nothing
2. Else attempt strict match by channel:
   - `channel = 'email'`: match `customers.email = inbox_conversations.primary_handle`
   - `channel IN ('sms','whatsapp')`: match `customers.phone = inbox_conversations.primary_handle`
3. Results:
   - **0 matches:** `link_state='unlinked'`, `person_id=null`, `link_meta='{}'`
   - **1 match:** `person_id=<id>`, `link_state='linked'`, `link_meta='{}'`
   - **>1 matches:** `link_state='ambiguous'`, `person_id=null`, `link_meta={ candidates: [ids], matched_on: 'email'|'phone' }`

**Note:** `primary_handle` for email is already clean email-only in existing data.

### Where to run auto-link
- After conversation upsert in:
  - `twilio-sms-webhook` (SMS inbound)
  - `inbox-gmail-sync` (Gmail ingestion)
  - Twilio WhatsApp webhook (when/if implemented)

**Implementation:** Reusable helper in each Edge Function (or shared `_shared` module). Idempotent: safe to call multiple times.

---

## Manual Linking

### Actions
- **Link conversation to person:** `UPDATE inbox_conversations SET person_id=?, link_state='linked', link_meta='{}' WHERE id=?`
- **Unlink:** `UPDATE inbox_conversations SET person_id=null, link_state='unlinked', link_meta='{}' WHERE id=?`

### Write path
- **Pattern:** Direct Supabase client (same as archive). Add `linkConversation(id, personId)` and `unlinkConversation(id)` to `inboxConversations.api.ts`. Use `updateConversation` or dedicated functions.

---

## UI Requirements

### Layout
`[People sidebar] → [Conversations list] → [Message thread]`

### People sidebar
- Search People (name, email, phone)
- Select a person to filter conversations to that person’s
- Default when no person selected: show **Unlinked** conversations (`status='open'` AND `person_id IS NULL`)

### Conversation header (right panel)
- **Unlinked or ambiguous:** Show banner "Not linked to a person" + Link action
- **Ambiguous:** Show candidate list first; option to search People and select correct person
- **After linking:** Show Person display name (`first_name` + `last_name`; fallback to email/phone)

### Person display
- Use `first_name` + `last_name` from `customers`
- Fallback: email or phone if name empty

### Unlinked view
- Conversations where `status='open'` AND `person_id IS NULL`

### Ambiguous handling
- `link_state='ambiguous'`
- Show "Choose person" banner with preloaded candidates from `link_meta.candidates`
- Fetch customers by IDs; allow searching all customers and selecting correct one (overrides ambiguous)

---

## Acceptance Criteria

### Data / DB
- [ ] `inbox_conversations` has `person_id`, `link_state`, `link_meta` columns
- [ ] No existing Inbox flows break when `person_id` is null
- [ ] Indexes exist; queries remain fast

### Auto-link
- [ ] New inbound messages create/update conversation and attempt link automatically
- [ ] Email matches by `customers.email`; SMS/WhatsApp by `customers.phone`
- [ ] Duplicate matches → `link_state='ambiguous'`, candidates in `link_meta`
- [ ] 0 matches → remains unlinked

### Manual link
- [ ] User can link any conversation to a person
- [ ] User can unlink a conversation
- [ ] After link, conversation shows person name in header and appears under that person in People filter

### UI
- [ ] People sidebar exists with search
- [ ] Selecting a person shows only their conversations
- [ ] Default shows Unlinked conversations
- [ ] "Choose person" banner appears when needed; resolves ambiguous/unlinked
- [ ] Person display uses `first_name` + `last_name` (fallback to email/phone)

---

## Non-goals (this scope)
- Linking conversations to Orders/Invoices (later)
- Global combined timeline merging channels
- Fuzzy matching or heuristics
- Backfill jobs

---

## QA Checklist

- [ ] Create customer with email X and phone Y
- [ ] Receive inbound email from X → conversation auto-links
- [ ] Receive inbound SMS from Y → conversation auto-links
- [ ] Create two customers with same phone → inbound SMS produces ambiguous banner with candidates
- [ ] Manual link resolves ambiguous and moves conversation under selected person
- [ ] Unlink returns conversation to Unlinked view
- [ ] Archive still works (status changes) and respects existing filters

---

## File-Level Summary

| Deliverable          | Action | Path |
|----------------------|--------|------|
| Migration            | Create | `supabase/migrations/..._add_person_link_to_inbox_conversations.sql` |
| Auto-link (SMS)      | Update | `supabase/functions/twilio-sms-webhook/index.ts` |
| Auto-link (Gmail)    | Update | `supabase/functions/inbox-gmail-sync/index.ts` |
| Auto-link (WhatsApp) | Create/Update | `twilio-whatsapp-webhook` or equivalent when exists |
| Link/Unlink API      | Update | `src/modules/inbox/api/inboxConversations.api.ts` |
| People sidebar       | Create | New component in `src/modules/inbox/` |
| Inbox layout         | Update | `UnifiedInboxPage.tsx` — add People sidebar, Unlinked filter |
| Conversation header  | Update | `ConversationView.tsx` — link banner, person display |
| Types                | Update | `inbox.types.ts` — add `person_id`, `link_state`, `link_meta` |

---

**Branch:** `feature/people-inbox-linking`  
**Spec version:** 1.0
