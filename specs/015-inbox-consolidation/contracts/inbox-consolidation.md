# Contract: Unified Inbox Consolidation (015)

**Feature**: 015-inbox-consolidation  
**Applies to**: Native inbox UI, routing, conversation stage updates, conversation and message org stamps

## 1. Routing contract

| Route | Behaviour |
|-------|-----------|
| `GET /dashboard/inbox` | Canonical unified inbox (`UnifiedInboxPage`) |
| `GET /dashboard/enquiry-triage` | `302`/React `Navigate` → `/dashboard/inbox?segment=enquiries` (preserve `conversation` query param if present) |
| `GET /dashboard/ghl-inbox` | **Unchanged** |

Sidebar **Inbox** (`AI Workflows` section) → `/dashboard/inbox`.

## 2. URL state contract

| Param | Values | Default |
|-------|--------|---------|
| `segment` | `enquiries` \| `all` | `all` |
| `conversation` | UUID | none |
| `enquiryStage` | `new` \| `in_progress` | none (show both columns) |
| `channel` | `all` \| `email` \| `whatsapp` \| `sms` | `all` |

Legacy `/enquiry-triage?conversation=<id>` → `/dashboard/inbox?segment=enquiries&conversation=<id>`.

## 3. Segment behaviour contract

### `segment=all` (operational)

- Retains Conversations / Customers view modes.
- Retains reply, link/unlink, bulk delete, order context panel.
- Right panel: `PersonOrdersPanel` when linked person/order context applies.

### `segment=enquiries`

- Lists only `status=open` AND `order_id IS NULL` conversations.
- Renders `EnquiryPipelineBoard` as a **two-column funnel**: **New** → **In progress** (bucket by `enquiry_stage`: `new` or `in_progress` only).
- **No third column.** When an enquiry is linked to an order (`order_id` set), the card **leaves the funnel** immediately with a **brief confirmation** (toast or inline ack); it does not move to another column.
- **No** AI confidence, extraction, or "not yet analysed" UI.
- Right panel rules:
  - Selected unlinked enquiry (`order_id` null) → `EnquiryCreateOrderPanel` (deterministic prefill + `CreateOrderDrawer`)
  - After successful order link, selection clears and the card is removed from the board (see above); user opens linked order via **All / Linked** segment or Orders as today

## 4. Enquiry stage API contract

### Read

Included in existing `fetchConversations` / `fetchConversation` `select('*')` responses as `enquiry_stage`.

### Write — mark in progress

```typescript
updateConversation(conversationId, { enquiry_stage: 'in_progress' })
```

Authorization: existing RLS on `inbox_conversations` UPDATE (unchanged).

### Write — order created

```typescript
linkConversationToOrder(conversationId, orderId)
// implementation: { order_id: orderId, enquiry_stage: 'order_created' }
```

## 5. Create-order prefill contract

`EnquiryCreateOrderPanel` passes to `CreateOrderDrawer`:

| Field | Source (priority order) |
|-------|-------------------------|
| `initialPersonId` | `conversation.person_id` |
| `initialCustomerName` | `people.first_name` + `people.last_name` |
| `initialCustomerEmail` | `people.email` OR email handle from conversation |
| `initialCustomerPhone` | `people.phone` OR `primary_handle` when channel is sms/whatsapp |

**Must not** read `inbox_enquiry_extraction`.

On success: `linkConversationToOrder(conversationId, newOrder.id)`.

## 6. Org-stamp insert contract (AC-005)

All inserts into `inbox_conversations` or `inbox_messages` MUST carry a non-null `organization_id`. These paths use a service-role or otherwise non-interactive Supabase client where `auth.uid()` is null — RLS is bypassed and will not reject null-org rows. The stamp MUST be applied in application code, not inferred from UI session context alone.

### Rules

| Target | `organization_id` source |
|--------|--------------------------|
| `inbox_messages` insert | Parent `inbox_conversations.organization_id` for the given `conversation_id`; throw if parent missing or org null |
| `inbox_conversations` insert (new thread) | Resolve at creation (e.g. `resolveOrganizationIdForUser` from user + connection, or order/proof record for `proof-send`); throw if unresolved |
| Conversation + message in same flow | Same resolved org on **both** parent and child inserts |

### Client — `createMessage` (`inboxMessages.api.ts`)

**Precondition**: `message.conversation_id` is set.

**Algorithm**:

1. `SELECT organization_id FROM inbox_conversations WHERE id = conversation_id`
2. If missing → throw (no silent failure)
3. `INSERT inbox_messages { ...message, organization_id }`

### Edge — `inbox-gmail-new-thread`

**Algorithm**:

1. Resolve `organization_id` via `resolveOrganizationIdForUser(supabase, userId, connection.organization_id)` before any insert
2. If unresolved → abort (no silent null)
3. `INSERT inbox_conversations { ..., organization_id }`
4. `INSERT inbox_messages { ..., organization_id }` (same resolved org)

### Edge — `inbox-gmail-sync`

**Algorithm**:

1. After `conversationId` is settled (found or created), resolve `organization_id` once
2. If unresolved → abort
3. Stamp both conversation insert (when creating) and message insert with the same org

### Edge — `proof-send` (email and WhatsApp branches)

**Algorithm**:

1. Derive `organization_id` from the order/proof record the dispatch acts on (not from a Gmail connection)
2. If unresolved → abort
3. Stamp both conversation and message inserts in each branch

### Edge — `twilio-sms-webhook` (verify only)

Already stamps `organization_id` on conversation backfill and message insert. Optional hardening: prefer `existingConv.organization_id` over connection-resolved `tenantOrgId` when the conversation already exists. No required change for 015.

**Out of scope**: `ghl-webhook` does not write `inbox_messages` or `inbox_conversations`.

## 7. Visibility contract (dual-scoped, unchanged)

| Channel | Visibility rule |
|---------|-----------------|
| Email | Rows where `user_id = auth.uid()` (private mailbox) |
| WhatsApp / SMS | Rows where `user_is_member_of_org(organization_id)` and shared-channel semantics (`user_id IS NULL`) |

Enquiries segment MUST NOT expose email threads across users.

## 8. Module boundary contract

- All new UI/hooks/api under `src/modules/inbox/`
- `src/modules/enquiryTriage/` **deleted** — zero remaining imports
- `CreateOrderDrawer` imported from `@/modules/orders` public surface only
- No `organizationId === '<uuid>'` branching
