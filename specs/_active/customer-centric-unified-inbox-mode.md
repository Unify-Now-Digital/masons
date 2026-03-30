# Customer-Centric Unified Inbox Mode

## Overview

Add a new customer-centric inbox mode to the existing Inbox page so users can view and reply from one mixed cross-channel thread (Email, SMS, WhatsApp) per linked person, while preserving all existing channel-centric behavior.

**Context:**
- Current inbox is conversation-centric (`inbox_conversations`) with message threads loaded from `inbox_messages`.
- Existing filters (All, Unread, Urgent, Unlinked), channel filter, and channel-specific thread behavior must remain unchanged.

**Goal:**
- Introduce a new left-sidebar mode that groups by person/customer instead of conversation.
- Keep channel tables and auditability unchanged; unified mode is a read/interaction layer over existing data.

---

## Current State Analysis

### Inbox Conversation Layer Schema

**Table:** `inbox_conversations`

**Current Structure:**
- Core fields consumed in UI: `id`, `channel`, `primary_handle`, `subject`, `status`, `unread_count`, `last_message_at`, `last_message_preview`, `person_id`, `link_state`.
- Existing person linkage is already present via `person_id` and `link_state`.
- Existing access path is direct Supabase query from frontend (`fetchConversations` in `src/modules/inbox/api/inboxConversations.api.ts`).
- Existing filtering supports status, channel, unread-only, unlinked-only, and text search.

**Observations:**
- Conversation list is currently one row per channel conversation, not one row per person.
- Unread counts are stored per conversation and can be aggregated by person without schema changes.

### Inbox Message Layer Schema

**Table:** `inbox_messages`

**Current Structure:**
- Core fields consumed in UI: `id`, `conversation_id`, `channel`, `direction`, `from_handle`, `to_handle`, `body_text`, `subject`, `sent_at`.
- Messages are fetched by single conversation (`fetchMessagesByConversation`) or by multiple conversations (`fetchMessagesByConversationIds`).
- Existing mixed-person timeline hook already exists (`usePersonUnifiedTimeline`) and sorts messages chronologically.

**Observations:**
- Chronological mixed-channel rendering is already technically possible and partially implemented.
- Outbound send operations already persist to real channel conversation/message rows via existing edge-function APIs.

### Relationship Analysis

**Current Relationship:**
- `inbox_messages.conversation_id -> inbox_conversations.id`.
- `inbox_conversations.person_id` links conversations across channels to the same person.
- Existing auto-linking pipelines already populate `person_id` for linked records.

**Gaps/Issues:**
- Primary Inbox page (`UnifiedInboxPage`) currently drives selection by `conversationId`, not `personId`.
- Existing `AllMessagesTimeline` component is not wired into the active Inbox page.
- Unified composer currently hides unavailable channels rather than showing disabled options (requirement asks disabled channels).

### Data Access Patterns

**How Conversations Are Currently Accessed:**
- `useConversationsList(filters)` in `src/modules/inbox/hooks/useInboxConversations.ts`.
- Used by `src/modules/inbox/pages/UnifiedInboxPage.tsx` to render left sidebar rows.
- Filtered by list filter + channel filter + search at query level; urgent is client-side text match.

**How Messages Are Currently Accessed:**
- `useMessagesByConversation(conversationId)` for channel thread mode.
- `usePersonUnifiedTimeline(personId)` for mixed timeline by person.

**How They Are Queried Together (if at all):**
- In unified timeline hook: fetch conversations by `person_id`, extract IDs, then fetch messages with `.in(conversation_id, ids)`.
- UI rendering via `ConversationThread` already supports channel badges, unified reply channel selection, and mixed timeline display.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- No new permanent tables required.
- No mandatory schema migration required for MVP unified mode.
- Optional future optimization (not required for initial delivery): add SQL view/RPC for person-level aggregates if data volume requires server-side grouping.

**Non-Destructive Constraints:**
- Keep `inbox_conversations` and `inbox_messages` as source of truth.
- No renames/deletions of existing inbox columns or tables.
- Preserve existing RLS behavior and existing channel-specific APIs.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Reuse existing `useConversationsList(baseFilters)` and aggregate person rows client-side for new mode.
- For selected person in unified mode, reuse `usePersonUnifiedTimeline(personId)` for message timeline.
- Build `conversationIdByChannel` from latest active conversation per channel for send routing.

**Recommended Display Patterns:**
- Existing mode: unchanged (conversation rows).
- New unified mode: one row per linked person, showing combined unread count and latest message preview/timestamp across all channels.
- Timeline: reuse `ConversationThread` with mixed messages and explicit channel badges on every message.

---

## Implementation Approach

### Phase 1: Add Unified Customer Mode Toggle and Data Model
- Update `src/modules/inbox/pages/UnifiedInboxPage.tsx`:
  - Add new mode state (e.g., `viewMode: 'conversations' | 'customers'`).
  - Preserve existing default mode and existing filters behavior outside unified mode.
  - In customer mode, derive grouped rows from conversation list by `person_id` (exclude unlinked/null `person_id`).
  - Select by `personId` in customer mode; keep `selectedConversationId` flow for existing mode.
- Update `src/modules/inbox/types/inbox.types.ts`:
  - Add UI-only types for unified row model and channel availability metadata (frontend type only).
- Add/extend hook in `src/modules/inbox/hooks/useInboxMessages.ts`:
  - Keep `usePersonUnifiedTimeline`.
  - Add helper for per-person channel routing map (latest conversation per channel) and default reply channel (latest inbound channel).

### Phase 2: Sidebar + Thread Wiring for Customer Mode
- Extend `src/modules/inbox/components/InboxConversationList.tsx`:
  - Add support for rendering either conversation rows (existing) or customer rows (new mode).
  - Keep existing tabs and channel filter controls visible and behaviorally unchanged in conversation mode.
  - In customer mode, show one row per person with combined unread count and latest preview.
- Update `src/modules/inbox/components/ConversationView.tsx` (or add `CustomerConversationView.tsx`):
  - In unified mode, load person timeline (mixed messages) instead of single conversation thread.
  - Keep right panel behavior unchanged by passing selected person to `PersonOrdersPanel`.
- Wire existing `src/modules/inbox/components/AllMessagesTimeline.tsx` into the active page flow (or fold its logic into `ConversationView`) to avoid duplicate unified-thread logic.

### Phase 3: Reply Routing and Channel Rules in Unified Mode
- Keep send mutation entry point in `useSendReply`; do not replace channel-specific APIs.
- Ensure unified composer channel selector:
  - Defaults to latest inbound channel for selected person.
  - Lets user manually switch channels.
  - Shows all three channels with disabled state when no valid destination (no active mapped conversation).
- Ensure routing rules:
  - Email -> latest email conversation for person; send via `sendGmailReply` (existing thread semantics).
  - SMS -> latest SMS conversation for person; send via `sendSmsReply`.
  - WhatsApp -> latest WhatsApp conversation for person; send via `sendTwilioMessage`.
- Keep auditability: all outbound writes remain on real `inbox_messages` rows under real `conversation_id`.

### Safety Considerations
- Do not alter current channel-tab logic path when `viewMode='conversations'`.
- Keep existing query keys and realtime invalidation, then add unified-mode invalidations for selected person timeline after send/realtime updates.
- Add focused UI tests and manual checks for mode switching to prevent regressions in existing tabs.

---

## What NOT to Do

- Do not replace existing channel conversation storage with a new unified table.
- Do not change current behavior for existing tabs/filters in conversation mode.
- Do not create brand-new email threads from unified replies when an email conversation exists for that person.
- Do not include unlinked conversations in customer mode rows (unless a clearly linked person exists).
- Do not duplicate send logic outside existing `useSendReply` and channel API modules.

---

## Open Questions / Considerations

- **Mode naming:** prefer `Customers` if consistent with product language; fallback `Unified`.
- **Channel filter behavior in customer mode:** apply as "people with at least one matching-channel conversation" while still showing mixed timeline once opened, or filter only row eligibility and keep full mixed timeline (recommended: filter row eligibility only).
- **Unread semantics in customer mode:** aggregate `sum(unread_count)` across linked conversations for selected person.
- **Large datasets:** if person-grouping becomes heavy client-side, add a SQL view/RPC for person aggregates (phase-2 optimization, not initial requirement).
- **Code hygiene risk:** repository currently includes duplicate Windows-path variants under `src\modules\...`; avoid touching those duplicates and keep changes in canonical `src/modules/...` paths only.
- **Acceptance Criteria:**
  - Existing mode behavior unchanged for All/Unread/Urgent/Unlinked and channel-specific conversation selection.
  - New customer mode shows one row per linked person and combined unread count.
  - Selecting customer opens mixed chronological timeline across Email/SMS/WhatsApp with channel badge on every message.
  - Unified composer defaults to latest inbound channel, allows manual override, and disables unavailable channels.
  - Outbound sends route into latest active channel conversation and persist in existing conversation/message records.
  - Right-side customer/order panel remains functional in both modes.
