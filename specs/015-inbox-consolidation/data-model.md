# Data Model: Inbox Consolidation (015)

**Branch**: `015-inbox-consolidation`  
**Storage**: PostgreSQL (Supabase), existing `inbox_conversations` + `inbox_messages`

## Schema change (additive only)

### Migration: `YYYYMMDDHHmmss_inbox_enquiry_stage.sql`

```sql
alter table public.inbox_conversations
  add column if not exists enquiry_stage text not null default 'new'
  constraint inbox_conversations_enquiry_stage_check
    check (enquiry_stage in ('new', 'in_progress', 'order_created'));

comment on column public.inbox_conversations.enquiry_stage is
  'Human-driven enquiry triage stage (new | in_progress | order_created). Email rows inherit per-user visibility via user_id; WhatsApp/SMS rows are workshop-shared. order_created is set on order link for audit/query; Enquiries UI shows two board columns only (new, in_progress) — linked rows leave the funnel.';

create index if not exists idx_inbox_conversations_enquiry_pipeline
  on public.inbox_conversations (organization_id, enquiry_stage, last_message_at desc nulls last)
  where status = 'open' and order_id is null;
```

**No RLS policy changes.** Stage column is readable/writable under existing `inbox_conversations` policies.

## Entity relationships

```text
organizations
    └── inbox_conversations (organization_id, user_id?, channel, order_id?, person_id?, enquiry_stage)
            └── inbox_messages (conversation_id, organization_id)  ← org stamped from parent

people (canonical person table)
    └── inbox_conversations.person_id (optional link)

orders
    └── inbox_conversations.order_id (optional; on link sets enquiry_stage = order_created and removes row from Enquiries funnel)
```

## Enquiry (logical) — query definition

An **enquiry** is a row in `inbox_conversations` where:

- `status = 'open'`
- `order_id IS NULL`
- `organization_id = <active org>`
- Visible under existing dual-scoped rules (same as operational fetch)

**Not** sourced from `inbox_enquiry_extraction` (AI table remains; unused in UI).

**Enquiries board** shows only rows with `enquiry_stage IN ('new', 'in_progress')` (both require `order_id IS NULL`). There is **no third board column** for `order_created`.

## Stage state machine

### DB values (migration check constraint — all three remain valid)

| Value | When set | On Enquiries board? |
|-------|----------|---------------------|
| `new` | Default for unlinked open conversation | **Yes** — **New** column |
| `in_progress` | Staff marks in progress | **Yes** — **In progress** column |
| `order_created` | `linkConversationToOrder` / order link (`order_id` set) | **No** — row excluded from fetch; card leaves funnel with confirmation |

### UI funnel columns (two only)

| Board column | Row filter |
|--------------|------------|
| **New** | `order_id IS NULL` AND `enquiry_stage = 'new'` |
| **In progress** | `order_id IS NULL` AND `enquiry_stage = 'in_progress'` |

**Transitions**:

```text
new ──(staff: mark in progress)──► in_progress
new / in_progress ──(order linked)──► order_created (+ order_id); card leaves Enquiries board with brief confirmation
in_progress ──(staff: revert)* ──► new   [* optional v2; not in v1 unless needed]
```

v1: no revert UI required; staff can leave as `in_progress` until order created.

## Stage visibility matrix (RLS consequence)

| Channel | `user_id` on row | Who sees conversation + `enquiry_stage` |
|---------|------------------|-------------------------------------------|
| `email` | `= auth.uid()` | Owning user only (intended dual-scoped model) |
| `whatsapp`, `sms` | `NULL` | All `user_is_member_of_org(organization_id)` members |

Consolidation does **not** widen email visibility to make stages workshop-shared.

## Org stamp on `inbox_messages` (no schema change)

Column `inbox_messages.organization_id` already exists (migration `20260411140300`).

| Write path | Parent source |
|------------|---------------|
| `createMessage` (client internal note) | `inbox_conversations.organization_id` via `conversation_id` |
| `twilio-sms-webhook` inbound insert | `inbox_conversations.organization_id` from matched/created parent row |

## Types (frontend)

Extend `InboxConversation` in `src/modules/inbox/types/inbox.types.ts`:

```typescript
enquiry_stage?: 'new' | 'in_progress' | 'order_created';
```

Extend `InboxConversationUpdate` to allow `enquiry_stage` updates.

## Tables explicitly untouched

- `inbox_enquiry_extraction` — no reads in unified inbox UI
- `ghl_connections` / GHL inbox module
- RLS policies on `inbox_conversations`, `inbox_messages`

## Person entity

All person prefill reads go through `public.people`:

- `useCustomer(personId)` → `supabase.from('people')`
- Do **not** use `public.customers` view
