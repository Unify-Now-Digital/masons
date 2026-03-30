# Inbox UI  Real Messages from public.messages

## Overview

Wire the existing Unified Inbox UI to read real messages from the `public.messages` table (via existing data access) instead of demo/mock data, in a strictly read-only fashion.

**Context:**
- Next.js app (App Router + Pages Router mix) with Supabase as the backend
- `public.messages` table already exists and is used elsewhere
- Orders  Messages relationship and data layer are implemented (`order_id`, `company_id` fields)
- Inbox module currently uses hardcoded demo `communications` data in `UnifiedInboxPage.tsx`

**Goal:**
- Replace the demo inbox data with real messages from `public.messages`
- Keep the current Inbox layout and styling as intact as possible
- Preserve read-only behavior (no sending, replying, or status changes)

---

## Current State Analysis

### Entity 1 Schema

**Table:** `public.messages`

**Current Structure (relevant fields):**
- `id: uuid` (primary key)
- `order_id: uuid | null` (nullable; relates to `orders.id`)
- `company_id: uuid | null`
- `from_name: text` (sender name)
- `from_email: text | null`
- `from_phone: text | null`
- `subject: text | null`
- `content: text` (body text)
- `type: text` (e.g. 'email', 'phone', 'note', 'internal')
- `direction: text` ('inbound' | 'outbound')
- `priority: text` ('low' | 'medium' | 'high')
- `is_read: boolean`
- `created_at: timestamptz`
- `updated_at: timestamptz`

**Foreign Keys / Indexes:**
- `order_id`  `public.orders(id)` (nullable, on delete set null)
- Index on `order_id`
- Index on `company_id`

**Observations:**
- Already contains all fields required for a basic inbox view (sender, content, timestamp)
- Ordering by `created_at DESC` is supported via the existing `fetchMessages()` implementation
- No schema changes are needed for read-only inbox display

### Entity 2 Schema

**Table:** (UI-level) `UnifiedInboxPage` demo data

**Location:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Current Structure:**
- Local `Communication` type (demo only):
  - `id: number`
  - `type: "email" | "phone" | "calendar"`
  - `from: string`
  - `subject: string`
  - `content: string`
  - `timestamp: string` (e.g. "2 hours ago")
  - `status: "unread" | "read"`
  - `orderId: string`
  - `priority: "high" | "medium" | "low"`
- `const communications: Communication[] = [...]` demo array used as the only data source

**Observations:**
- Unified Inbox is visually complete but powered entirely by static demo data
- The demo `Communication` shape is similar but not identical to `Message` (different field names and types)
- All filtering, tab logic, and selection state operate on the in-memory `communications` array

### Relationship Analysis

**Current Relationship:**
- No runtime relationship between `UnifiedInboxPage` and `public.messages`
- Real messages are already accessible via the data layer but unused by the Inbox UI

**Gaps/Issues:**
- Inbox shows stale, non-persistent demo items instead of real messages
- No direct mapping from `Message` fields (`from_name`, `content`, `created_at`) into the inbox cards
- Any updates in the database are not reflected in the Inbox UI

### Data Access Patterns

**How `public.messages` is Currently Accessed:**

**Location:** `src/modules/inbox/api/inbox.api.ts`, `src/modules/inbox/hooks/useMessages.ts`

- `fetchMessages()`
  - `select('*')` from `messages`
  - `order('created_at', { ascending: false })`
  - Returns `Message[]`
- `useMessagesList()`
  - React Query hook wrapping `fetchMessages`
  - Query key: `['messages']`

**How Unified Inbox Currently Accesses Data:**

- `UnifiedInboxPage.tsx` imports **no** data-access functions
- Uses in-file `communications` constant for all list rendering, filtering, unread counts, etc.
- Tabs filter by `type` and `status` on the demo array only

**How They Are Queried Together (if at all):**

- Currently **not** queried together: Inbox never touches `public.messages` or `useMessagesList()`

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- None.

**Non-Destructive Constraints:**
- No new columns, tables, or indexes required.
- All necessary data already exists in `public.messages` and is exposed via `fetchMessages()`.

### Query/Data-Access Alignment

- Verify that `fetchMessages()` / `useMessagesList()` already order by `created_at DESC`.
  If not, adjust ordering inside the existing query without changing its API.

**Recommended Query Patterns:**
- Use the existing `fetchMessages()` / `useMessagesList()` pipeline to retrieve messages for the Inbox:
  - `useMessagesList()` in `UnifiedInboxPage` to fetch `Message[]` ordered by `created_at DESC`.
  - Optional client-side limiting (e.g. show most recent N messages) can be handled in the UI without schema changes.

**Recommended Display Patterns:**
- Map `Message`  Inbox card fields as follows:
  - `from_name`  `from`
  - `subject` (fallback to content preview if null)  `subject`
  - `content`  body preview
  - `created_at`  timestamp label (formatted string; more precise than "2 hours ago" if desired)
  - `order_id`  existing "Order: {orderId}" badge
  - `priority`  existing priority badge colors (`high` / `medium` / `low`)
- Preserve current layout:
  - Two-column grid: left list of messages, right `ConversationView`
  - Same card structure and Tailwind classes

---

## Implementation Approach

### Phase 1: Replace Demo Data with Real Messages

- Add `useMessagesList()` to `UnifiedInboxPage.tsx` and remove the hardcoded `communications` array.
- Introduce a light-weight view model mapping from `Message` to the existing card props:
- Introduce a light-weight view model mapping from `Message` to the existing card props,
  using only fields already present on `Message`.
- No derived read/unread state is introduced in this phase.
- The Inbox does not infer or display read/unread status beyond what is already visually present.
- Use the React Query loading state to drive the Inbox loading UI.

### Phase 2: Inbox List & Selection Behavior

- Keep the existing tab UI (`all`, `unread`, `email`, `phone`) visually unchanged.
- Tabs that rely on read/unread state or message type do not introduce new filtering logic
  in this phase and may act as no-ops.
- Only basic text search (subject/from) continues to function as it does today.
- Maintain the existing selection and `ConversationView` wiring:
  - When a card is clicked, set `selectedCommunication` based on the mapped `Message`.
- Ensure that order badges use `order_id` from `Message`.

### Safety Considerations

- Read-only: no mutations will be triggered from the Inbox UI.
- If the messages query fails, fall back to an error/empty state within the list area (no global impact).
- The change is isolated to `UnifiedInboxPage.tsx`; no other modules (Orders, OrderDetailsSidebar, etc.) are touched.
- Any changes to `ConversationView` are limited strictly to TypeScript prop typing.
- No runtime behavior, rendering logic, or side effects in `ConversationView` may be changed.

---

## What NOT to Do

- Do **not** add or modify database tables, columns, or migrations.
- Do **not** create new Supabase functions or REST endpoints.
- Do **not** implement sending, replying, or editing messages.
- Do **not** add read/unread mutation logic or status toggling.
- Do **not** introduce order-based filtering yet.
- Do **not** change Orders or `OrderDetailsSidebar` behavior.

---

## Open Questions / Considerations

## Decisions for This Phase

- Read/unread status is not implemented or inferred in this phase.
- Message loading uses the existing `useMessagesList()` behavior without pagination changes.
- Timestamps are displayed using a simple formatted date-time string
  (e.g. `toLocaleString()`), not relative time.

