[# Fix Inbox email → person linking regression]

## Overview

This spec analyses and scopes a fix for the regression where **Inbox email conversations no longer auto-link to People/customers by email address**, while WhatsApp/SMS linking continues to work. It documents the current schema and data-access paths for inbox conversations and people, identifies root causes, and defines a safe, incremental fix focused on backend linking logic (no UI changes).

**Context:**
- Unified Inbox uses `inbox_conversations` and `inbox_messages` as the canonical message store across channels.
- Conversations have a nullable `person_id` pointing to the **`customers`** table, plus a `link_state` flag and `link_meta` JSON for auto-link status.
- A new per-user Gmail sync flow (`supabase/functions/gmail-sync-now`) was introduced alongside the earlier admin Gmail importer (`supabase/functions/inbox-gmail-sync`).
- A backfill migration (`20260304130000_inbox_customers_email_link_backfill.sql`) populates `person_id` for existing email conversations based on `primary_handle` → `customers.email`.

**Goal:**
- Restore **reliable, deterministic auto-linking** for email conversations using normalized email addresses.
- Keep **`customers`** as the canonical People table for inbox linking (for now), with clear boundaries vs any future `people` table.
- Ensure **idempotent, non-destructive behavior** so manual links and existing correct links are never overwritten by background jobs.

---

## Current State Analysis

### `inbox_conversations` Schema

**Table:** `public.inbox_conversations`

**Current Structure:**
- Key columns used for linking:
  - `id uuid primary key`
  - `channel text` — `'email' | 'sms' | 'whatsapp'`
  - `primary_handle text` — email address or phone number (already normalized for email)
  - `person_id uuid null` — FK to `public.customers(id)` (`20260124130000_add_person_link_to_inbox_conversations.sql` lines 5–8)
  - `link_state text not null default 'unlinked' check in ('linked','unlinked','ambiguous')`
  - `link_meta jsonb not null default '{}'::jsonb`
  - Messaging fields: `subject`, `status`, `unread_count`, `last_message_at`, `last_message_preview`, `external_thread_id`, `user_id`, timestamps
- Indexes:
  - `idx_inbox_conversations_person_id_last_message_at` on `(person_id, last_message_at desc nulls last)` where `person_id is not null`
  - `idx_inbox_conversations_link_state_last_message_at` on `(link_state, last_message_at desc nulls last)`
  - `idx_inbox_conversations_user_id` on `(user_id)`
  - External-thread and activity-log triggers also exist but **do not modify** `person_id` or `link_state`.

**Observations:**
- `person_id` is explicitly documented as “Linked person (customer) when link_state=linked.” — the FK target is **`customers`**, not `people`.
- `link_state` and `link_meta` are used purely as **application-level flags**; there are no triggers that enforce or recompute them.
- RLS policies only control who can read/update rows; they do not touch linking fields.

### `customers` Schema (canonical People table for Inbox)

**Table:** `public.customers`

**Current Structure (relevant to linking):**
- `id uuid primary key`
- `email text null`
- `phone text null`
- Person-like fields: `first_name`, `last_name`, address fields, etc.
- Indexes:
  - `customers_email_lower_idx on public.customers (lower(email))` (`20260304130000_inbox_customers_email_link_backfill.sql` lines 1–3)
- Activity logs trigger uses `log_activity_generic` but does not alter email/phone semantics.

**Observations:**
- Inbox auto-link functions in edge functions **only** query `public.customers`, never `people`.
+- Email matching today is implemented via either:
  - Case-insensitive equality using `ilike` without wildcards in `inbox-gmail-sync` (`ilike(matchColumn, primaryHandle)` with `primaryHandle` lowercased), or
  - Exact equality (`.eq(matchColumn, primaryHandle)`) in `twilio-sms-webhook` for phone-based linking.
- The backfill migration (`20260304130000_inbox_customers_email_link_backfill.sql`) also treats `customers` as canonical and aligns `inbox_conversations.primary_handle` with `customers.email`.

### Relationship Analysis

**Current Relationship:**
- `inbox_conversations.person_id → customers.id` (FK, nullable).
- Auto-link decisions:
  - **Edge functions** set `person_id`, `link_state`, `link_meta`:
    - `supabase/functions/inbox-gmail-sync/index.ts` — `attemptAutoLink` for `channel='email'`.
    - `supabase/functions/twilio-sms-webhook/index.ts` — `attemptAutoLink` for `channel='sms' | 'whatsapp'`.
  - **Frontend Inbox API**:
    - `src/modules/inbox/api/inboxConversations.api.ts` — `linkConversation` / `unlinkConversation` mutate `person_id` and `link_state` directly.
- UI reads:
  - `src/modules/inbox/components/ConversationView.tsx` uses `useCustomer(conversation?.person_id)` from `customers` hooks.
  - `src/modules/inbox/components/InboxConversationList.tsx` uses `conversation.person_id` to decide whether to show linked names vs `primary_handle`.

**Gaps/Issues:**
- New per-user Gmail sync function `supabase/functions/gmail-sync-now/index.ts`:
  - **Creates** `inbox_conversations` rows (with `primary_handle` set from email headers).
  - **Never calls** any auto-link logic or updates `person_id`/`link_state`.
  - As a result, all email conversations created via this path stay `person_id=null`, `link_state='unlinked'`.
- There is **no code path anywhere that uses a `people` table** for Inbox linking; all runtime logic uses `customers`.
- The `inbox-gmail-new-thread` edge function also never calls auto-link; it relies on subsequent syncs to fill in linking, which only happens for the older admin `inbox-gmail-sync`, not `gmail-sync-now`.

### Data Access Patterns

**How `inbox_conversations` is Currently Accessed:**
- **Frontend:**
  - `src/modules/inbox/api/inboxConversations.api.ts`:
    - `fetchConversations(filters)` reads `*` with filters on `status`, `channel`, `person_id`, `unlinked_only`, `search` (via `primary_handle.ilike`, `subject.ilike`, `last_message_preview.ilike`).
    - `createConversation` inserts rows with:
      - `person_id` set from payload (optional).
      - `link_state` set to `'linked'` when `person_id` is provided, otherwise `'unlinked'`.
    - `linkConversation` / `unlinkConversation` **directly update** `person_id`, `link_state`, `link_meta`.
- **Edge functions:**
  - `supabase/functions/inbox-gmail-sync/index.ts`:
    - Imports Gmail messages via service role.
    - For each message:
      - Derives `primaryHandle`:
        - `direction = fromEmail === userEmail ? 'outbound' : 'inbound'`
        - `primaryHandle = direction === 'inbound' ? fromEmail : toEmail`
      - Finds or creates `inbox_conversations` row (channel `'email'`, `primary_handle` = `primaryHandle`).
      - Calls `attemptAutoLink(supabase, conversationId, "email", primaryHandle)` **after conversation creation**.
      - Later updates counts + last message data; these updates do not touch linking columns.
  - `supabase/functions/twilio-sms-webhook/index.ts`:
    - Normalizes Twilio `From`/`To` into `primaryHandle` for SMS/WhatsApp.
    - Finds/creates conversations and inserts messages.
    - Calls `attemptAutoLink(supabase, conversationId, channel, from.trim())` after updating conversation metadata.
  - `supabase/functions/gmail-sync-now/index.ts`:
    - Similar Gmail import, but:
      - Works per user with `gmail_connections` and `user_id`.
      - Writes `inbox_conversations` rows (channel `'email'`, `primary_handle`, `user_id`).
      - Inserts `inbox_messages`.
      - **Never calls `attemptAutoLink` or any email-linking logic.**

**How `customers` is Currently Accessed for Linking:**
- **Auto-link helper in `inbox-gmail-sync`**:
  - `attemptAutoLink` (`supabase/functions/inbox-gmail-sync/index.ts` lines 436–496):
    - Early exits if `conv.person_id` is already set.
    - Normalizes email for `channel === "email"` (`primaryHandle = rawHandle.toLowerCase()`).
    - Uses:
      - `matchColumn = channel === "email" ? "email" : "phone"`
      - `matchTable = "customers"`
      - For email: `query.ilike(matchColumn, primaryHandle)` (no `%`).
    - Result handling:
      - Exactly 1 match: `person_id = id`, `link_state='linked'`, `link_meta={}`.
      - >1 matches: `person_id=null`, `link_state='ambiguous'`, `link_meta={ candidates, matched_on }`.
      - 0 matches: `person_id=null`, `link_state='unlinked'`, `link_meta={}`.
- **Auto-link helper in `twilio-sms-webhook`**:
  - Local `attemptAutoLink` (`supabase/functions/twilio-sms-webhook/index.ts` lines 209–255) with the same pattern but:
    - No lowercasing; phone/email equality via `.eq(matchColumn, primaryHandle)`.
    - `matchTable` is also hard-coded to `customers`.

**How They Are Queried Together (if at all):**
- Frontend conversation view:
  - `ConversationView` uses `useCustomer(conversation?.person_id ?? '')` (customers by id) and `useOrdersByPersonId(conversation?.person_id ?? '')`.
  - No joins to any `people` table; everything references `customers.id`.
- Orders and invoices:
  - Orders have `person_id` -> `customers.id` and are used by Inbox person-orders panel, but that is adjacent, not directly part of auto-link.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- **No breaking schema changes required** to fix the regression:
  - `inbox_conversations.person_id` FK to `customers(id)` is correct for current code paths.
  - `link_state` and `link_meta` already support the required states (`linked`, `unlinked`, `ambiguous`).
- Optional, non-blocking enhancements (not required for minimal fix):
  - Introduce a **function-based index** on `lower(email)` that matches the access pattern used by `attemptAutoLink` if needed for performance:
    - Current index `customers_email_lower_idx on lower(email)` is already present and compatible with `lower(email) = $1` queries; the current `ilike` without wildcards works functionally but may not use this index optimally.

**Non-Destructive Constraints:**
- Keep all changes additive and idempotent:
  - **Do not** change existing FK target for `person_id` (remains `customers`).
  - **Do not** delete or rename columns in `inbox_conversations` or `customers`.
  - **Do not** add triggers that auto-mutate `person_id` based on unrelated updates; keep linking explicit in edge functions/migrations.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Consolidate auto-link logic into a **shared helper module** (e.g. `supabase/functions/_shared/autoLinkConversation.ts`) that:
  - Normalizes `primaryHandle` per channel.
  - Queries `customers` by strict equality on normalized email/phone.
  - Implements the 0/1/>1 match semantics consistently.
  - Early exits when `person_id` is already set.
- Ensure all edge functions that **create or touch email conversations** call this helper:
  - `gmail-sync-now`: **must** call `attemptAutoLink` for each resolved `conversationId` (unique per thread).
  - `inbox-gmail-new-thread`: may call auto-link immediately after conversation creation, or rely on sync—but for determinism, call the helper once on creation.
- Keep frontend `linkConversation` / `unlinkConversation` as the only place where users can manually override auto-linking.

**Recommended Display Patterns:**
- Maintain existing UI behavior:
  - Conversation list and view should continue showing **customer name** when `person_id` is present; fallback to `primary_handle` when unlinked.
  - Badges and banners should continue to interpret `link_state` as:
    - `'linked'` → linked.
    - `'unlinked'` → unlinked.
    - `'ambiguous'` → ambiguous candidates.
- No changes required to UI components for this regression fix.

---

## Implementation Approach

### Phase 1: Centralize auto-link logic and align on `customers`
- Extract the shared `attemptAutoLink` + `updateLinkState` helpers into `supabase/functions/_shared/autoLinkConversation.ts`, using the **customers-only** implementation from `inbox-gmail-sync` as the source of truth.
- Update:
  - `supabase/functions/inbox-gmail-sync/index.ts`
  - `supabase/functions/twilio-sms-webhook/index.ts`
  - (Optionally) any future inbox-related functions
  to import and use the shared helper instead of duplicating local versions.
- Confirm behavior:
  - For `channel='email'`, match on normalized email via `lower(trim(primary_handle))` vs `lower(customers.email)`.
  - For `channel IN ('sms','whatsapp')`, match on exact phone (E.164).

### Phase 2: Wire auto-link into `gmail-sync-now` and new-thread flows
- In `supabase/functions/gmail-sync-now/index.ts`:
  - After resolving `conversationId` for each Gmail message (either found by thread or newly inserted):
    - Call the shared `attemptAutoLink` once per **unique** `conversationId` in the loop, **after** conversation creation but **before** or independent of message insert.
    - Pass `channel='email'` and the same `primaryHandle` value used when inserting the conversation.
  - Ensure the helper uses service-role Supabase client, so RLS does not block linking.
- In `supabase/functions/inbox-gmail-new-thread/index.ts`:
  - After inserting the new `inbox_conversations` row (channel `'email'`, `primary_handle=trimmedTo`):
    - Option A (preferred): Immediately call shared `attemptAutoLink` with `channel='email'`, `primaryHandle=trimmedTo`.
    - Option B: Rely on subsequent `gmail-sync-now` run to link; in that case, clearly document that this function **does not** link and ensure sync is always responsible.
  - For deterministic UX, prefer Option A so outbound-initiated threads get linked immediately when an existing customer email is present.

### Phase 3: Backfill and verification
- Re-run or extend the existing backfill to ensure historical email conversations are linked consistently:
  - Keep `20260304130000_inbox_customers_email_link_backfill.sql` semantics:
    - `where c.channel = 'email' and c.person_id is null`
    - `and lower(trim(c.primary_handle)) = lower(trim(cust.email))`
    - set `person_id = cust.id`, `link_state='linked'`, and `link_meta.matched_on='email'`.
  - Optionally, create a **new idempotent migration** that:
    - Uses a canonical normalization function (e.g. `lower(trim(email))`) for both sides.
    - Ensures it is safe to run multiple times without disturbing already linked rows.
- Add lightweight diagnostics:
  - A one-off SQL query to count:
    - Email conversations with `person_id is not null and link_state != 'linked'`.
    - Email conversations with `person_id is null and link_state = 'linked'`.
    - Email conversations with `channel='email' and link_state='unlinked'` but matching `customers.email` by normalized email (should be zero after fix).

### Safety Considerations
- **Idempotency and non-destructive behavior:**
  - Auto-link helpers must **never overwrite** existing `person_id` values; they should early-return if `person_id` is already set.
  - Backfill migrations must filter on `person_id is null` to avoid changing user-approved links.
- **No table mismatch:**
  - Keep `person_id` pointing to `customers.id` for Inbox linking; if `people` becomes canonical later, plan a dedicated migration then (out of scope here).
- **Testing strategy:**
  - Unit-/integration-style tests via manual runs:
    - Create `customers` with unique and duplicate emails.
    - Trigger `gmail-sync-now` for inbound and outbound-only threads; verify `person_id` and `link_state` outcomes.
    - Trigger `twilio-sms-webhook` for phone-based linking to confirm regression hasn’t affected SMS/WhatsApp behavior.
  - Validate that manual linking via UI (`linkConversation` / `unlinkConversation`) remains authoritative and is not overwritten by background jobs.
- **Rollback:**
  - Since changes are additive and helper-based, rollback simply involves:
    - Reverting edge function code to previous versions.
    - Not applying any new backfill migration (or rolling back that migration if necessary).

---

## What NOT to Do

- **Do NOT** repoint `inbox_conversations.person_id` to a `people` table in this fix; that requires a separate, carefully planned migration.
- **Do NOT** auto-create new customers/people from email addresses as part of auto-link; only link when an exact match exists.
- **Do NOT** introduce fuzzy/wildcard matching beyond exact normalized email equality; keep matching deterministic.
- **Do NOT** add UI changes or new Inbox filters as part of this regression fix.
- **Do NOT** change RLS policies on `inbox_conversations` or `customers` beyond what’s already present; the service-role clients already bypass RLS.

---

## Open Questions / Considerations

- Should future “People” work migrate Inbox linking from `customers` to a dedicated `people` table, and if so, how will we backfill `person_id` safely without breaking existing references?
- Do we want to move all Gmail email ingestion to `gmail-sync-now` and deprecate `inbox-gmail-sync`, or will both coexist for some time?
- Is the existing `ilike`-based email comparison sufficient for all supported databases and indexes, or should we standardize on `lower(trim(email)) = lower(trim(primary_handle))` everywhere for clarity and performance?
- How often should we re-run backfill scripts in staging/production to repair historical gaps without risking surprises for users?

