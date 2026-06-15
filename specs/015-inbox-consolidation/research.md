# Research: Inbox Consolidation (015)

**Date**: 2026-06-14  
**Branch**: `015-inbox-consolidation`

## R1 — Enquiry stage persistence & RLS consequence

### Decision

Store human workflow stage on **`public.inbox_conversations.enquiry_stage`** (`text`, check constraint: `'new' | 'in_progress' | 'order_created'`, default `'new'`).

**`order_created` is a persisted DB state, not a board column**: on order link, set `enquiry_stage = 'order_created'` (and `order_id`) via `linkConversationToOrder`; the card **leaves the Enquiries funnel** with a brief confirmation — it does **not** move to a third column. The Enquiries board has **two columns only** (`new`, `in_progress`); fetch requires `order_id IS NULL`.

### RLS / visibility analysis

| Channel | `inbox_conversations.user_id` | Conversation visibility (intended, AC-004) | Stage visibility if column lives on row |
|---------|--------------------------------|--------------------------------------------|----------------------------------------|
| Email | `auth.uid()` of mailbox owner | **Private per user** | **Private per user** — only the owner sees their email enquiry and its stage |
| WhatsApp / SMS | `NULL` (shared channel) | **Workshop-shared** (`user_is_member_of_org`) | **Workshop-shared** — any org member sees the same stage |

### Acceptability of per-user-private email stage

**Yes — acceptable and chosen.** Email enquiries are triaged by the user who owns that Gmail connection; other staff cannot see those threads today. A workshop-wide stage table would either (a) break email privacy, or (b) require duplicate stage rows keyed by `(conversation_id, user_id)` with no conversation to attach to for hidden rows.

**Rejected alternative — separate `inbox_enquiry_triage` table (org-scoped only)**: Would make WhatsApp/SMS stages workshop-visible but could not represent email-private stages without mirroring dual-scoped RLS on a new table. Adds join complexity with no benefit over a column on the conversation row.

**Rejected alternative — workshop-wide stage regardless of channel**: Would imply User B could mark User A's private email enquiry "In progress" without seeing the thread — inconsistent and unusable.

### RLS policy stance (015)

- **Do NOT change** existing `inbox_conversations` / `inbox_messages` RLS policies in this feature.
- Stage updates use existing conversation `UPDATE` policies (org-member + row ownership semantics unchanged).
- Enquiries fetch MUST use the **same conversation query path** as operational inbox (`fetchConversations` / `useConversationsList`) so visibility stays identical in both segments.

---

## R2 — `/enquiry-triage` retirement

### Decision

1. Replace route element with `<Navigate to="/dashboard/inbox?segment=enquiries" replace />` in `src/app/router.tsx` (preserves AC-001 app-shell router; `src/pages/NotFound.tsx` untouched).
2. Point sidebar **Inbox** at `/dashboard/inbox` in `src/components/layout/Sidebar.tsx`.
3. **Delete** entire `src/modules/enquiryTriage/` module (4 files) — lift reusable UI into `src/modules/inbox/`, not a hidden import.

### Files removed (complete list)

| Path | Action |
|------|--------|
| `src/modules/enquiryTriage/pages/EnquiryTriagePage.tsx` | Delete (pipeline UI lifted to inbox) |
| `src/modules/enquiryTriage/hooks/useEnquiryTriage.ts` | Delete |
| `src/modules/enquiryTriage/api/enquiryTriage.api.ts` | Delete (logic moves to `inbox/api/enquiryPipeline.api.ts`) |
| `src/modules/enquiryTriage/index.ts` | Delete |

### Files updated (routing / nav)

| Path | Change |
|------|--------|
| `src/app/router.tsx` | Remove `EnquiryTriagePage` import; `enquiry-triage` → redirect `Navigate` |
| `src/components/layout/Sidebar.tsx` | `to: '/dashboard/inbox'` |
| `src/components/layout/PageShell.tsx` | Remove `enquiry-triage` title/subtitle map entries; add `inbox` copy if missing |

### URL migration

Old triage query params (`stage`, `tags`, `sort`, `conversation`) map to unified inbox:

- `?segment=enquiries` (default on redirect from `/enquiry-triage`)
- `conversation` → `?conversation=<id>` (preserve selection)
- `stage` → `?enquiryStage=<new|in_progress>` (optional column filter; **`order_created` is not a board filter** — linked rows leave the funnel)
- `tags`, `sort` — dropped (AI-tag derivation removed with AI chrome)

---

## R3 — Org stamp on conversation and message inserts (AC-005, carried from 013)

### Decision

Every insert into `inbox_conversations` or `inbox_messages` MUST carry a non-null `organization_id`. For **message** inserts, stamp from the **parent `inbox_conversations` row** at insert time. For **conversation** inserts, resolve `organization_id` at creation time (e.g. `resolveOrganizationIdForUser`, order/proof record). Never rely on `OrganizationContext` or connection-derived org alone when a parent conversation exists.

Post-audit correction: the gap is not inbound SMS (already stamps) but **three Gmail/proof edge functions** that insert both conversation and message rows with null `organization_id`. Those paths use a **service-role** Supabase client where `auth.uid()` is null — **RLS is bypassed** and will not reject unstamped rows. Application code must set `organization_id` explicitly before insert.

**Fix required (015)**:

| Path | Conv insert | Msg insert | Org source |
|------|-------------|------------|------------|
| client `inboxMessages.api.ts` | n/a | yes | `SELECT organization_id` from parent by `conversation_id`; throw if null |
| `inbox-gmail-new-thread` | yes | yes | `resolveOrganizationIdForUser(supabase, userId, connection.organization_id)` |
| `inbox-gmail-sync` | yes (when creating) | yes | Resolve once after `conversationId` settled; stamp both |
| `proof-send` (email ~395/416, WhatsApp ~511/530) | yes | yes | Order/proof record the dispatch acts on |

**Verify only**: `twilio-sms-webhook` — already stamps conversation backfill and message insert. Optional hardening: prefer `existingConv.organization_id` over connection-resolved `tenantOrgId`. No required change for 015.

**Out of scope / already compliant**: `ghl-webhook` does not insert inbox rows; `gmail-sync-now`, `inbox-gmail-send`, and five other writers already stamp correctly (see [plan.md](./plan.md) Explicit Decision 3).

### Path 1 — Client (`src/modules/inbox/api/inboxMessages.api.ts`)

`createMessage` is called by `useSaveInternalNote` in `useInboxMessages.ts` without `organization_id` today.

**Fix**:

```typescript
export async function createMessage(message: InboxMessageInsert) {
  const { data: parent, error: parentErr } = await supabase
    .from('inbox_conversations')
    .select('organization_id')
    .eq('id', message.conversation_id)
    .single();
  if (parentErr || !parent?.organization_id) {
    throw new Error('Cannot send message: conversation organisation not found');
  }
  const { data, error } = await supabase
    .from('inbox_messages')
    .insert({ ...message, organization_id: parent.organization_id })
    .select()
    .single();
  if (error) throw error;
  return data as InboxMessage;
}
```

### Path 2 — Edge service-role writers (`inbox-gmail-new-thread`, `inbox-gmail-sync`, `proof-send`)

These functions create `inbox_conversations` and `inbox_messages` under a service-role client. Both inserts must receive the same resolved `organization_id`; abort if resolution fails — do not insert with null org.

**`inbox-gmail-new-thread`**: Resolve via `resolveOrganizationIdForUser(supabase, userId, connection.organization_id)` before any insert; stamp conversation insert (~179) and message insert (~213).

**`inbox-gmail-sync`**: After `conversationId` is settled (found or created), resolve org once; stamp conversation insert when creating (~271) and message insert (~318).

**`proof-send`**: Derive org from the order/proof record the dispatch acts on (not a Gmail connection); stamp both inserts in the email branch (~395/416) and WhatsApp branch (~511/530).

### Path 3 — `twilio-sms-webhook` (verify only)

**Audit finding**: `supabase/functions/ghl-webhook/index.ts` does **not** insert `inbox_messages` or `inbox_conversations`. It only pulses `ghl_connections.updated_at` by GHL location id. **No org-stamp change applies to ghl-webhook.**

`twilio-sms-webhook` already stamps `organization_id` on conversation backfill (~267–268) and message insert (~320). Optional hardening when an **existing** conversation is matched — prefer parent org over connection-resolved `tenantOrgId`:

```typescript
const orgIdForMessage =
  (existingConv as { organization_id?: string | null })?.organization_id
  ?? tenantOrgId;
// ...
const msgPayload = { ...existing fields, organization_id: orgIdForMessage };
```

For **new** conversation branch, `organization_id: tenantOrgId` on both conversation and message insert remains correct. No required change for 015.

---

## R4 — Routing / dual-router convention (AC-001)

### Decision

Confirmed real repo convention per `constitution.md` and `src/app/router.tsx`:

- **App shell**: `src/app/router.tsx` composes all `/dashboard/*` nested routes inside `PageShell`.
- **Legacy pages**: `src/pages/NotFound.tsx` (and similar singletons) imported by app router — not removed.

Consolidation changes **only** `src/app/router.tsx` route entries and sidebar links. No new router library, no move to `src/pages/` for inbox.

---

## R5 — UI reuse (no rebuild)

### Decision

| Capability | Reuse |
|------------|-------|
| Operational list + thread | `InboxConversationList`, `ConversationView`, `ConversationThread`, `CustomerThreadList`, `CustomerConversationView` |
| Order context panel | `PersonOrdersPanel`, `OrderContextSummary` |
| Create order | `CreateOrderDrawer` from `@/modules/orders` — extend with optional prefill props only |
| Person lookup | `useCustomer` / `fetchCustomer` → queries `public.people` (via customers module) |
| Pipeline cards | Lift layout/styling from `EnquiryTriagePage.tsx` into `EnquiryPipelineBoard.tsx` — remove AI badges, confidence, extraction fetch |

### Remove from unified inbox

- `useEnquiryExtractions` usage in `UnifiedInboxPage.tsx`, `ConversationView.tsx`
- `inboxBuckets` extraction-dependent classification (keep bucket logic; drop extraction input)
- All `AIBadge` / `AISuggestion` chrome in enquiry segment

---

## R6 — Segment model vs existing view modes

### Decision

Add top-level **segment** URL param `segment=enquiries|all` (default `all`):

- **`enquiries`**: `EnquiryPipelineBoard` (left/center) + `ConversationView` (center thread) + state-driven right panel
- **`all`**: Preserve existing **Conversations / Customers** toggle (`viewMode` localStorage) — satisfies FR-006/FR-017 operational behaviour

Channel pills remain per-segment (reuse existing `ChannelFilter` types).

---

## R7 — Link conversation to order after create

### Decision

Add `linkConversationToOrder(conversationId, orderId)` in `inboxConversations.api.ts`:

```typescript
.update({ order_id: orderId, enquiry_stage: 'order_created' })
```

Called from `EnquiryCreateOrderPanel` / `CreateOrderDrawer` success callback when opened from enquiry context.

No org-specific branching; same path for all workshops.
