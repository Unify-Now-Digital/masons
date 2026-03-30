# Redesign Unified Inbox page UI/UX to match Claude-built mockup

## Overview

Replace the current Unified Inbox page layout and styling with a new design that matches the provided Claude-built mockup as closely as possible, while preserving all existing functionality, data loading, APIs, hooks, and business logic. This is primarily a frontend layout and styling refactor.

**Context:**
- **Current UI:** Four-column desktop layout (People sidebar | Conversation list | Conversation thread + composer | Orders panel), with tabs for All / Email / SMS / WhatsApp and person-driven filtering.
- **Target UI:** Three-column desktop-first layout (Conversation list | Conversation area | Order context panel). The People column is removed; person context is derived from the selected conversation.
- **Scope:** UI layout, structure, and styling only. Backend, APIs, hooks, and business logic remain unchanged unless necessary to support the new filter set or display.

**Goal:**
- **Primary:** Visually match the mockup with a three-column layout, redesigned conversation rows, new filter set (All / Unread / Urgent / Unlinked + channel dropdown), redesigned conversation header and order context panel.
- **Secondary:** Preserve conversation selection, message loading, sending replies, AI reply suggestions, person linking, archive/mark unread, order loading, and order switching. Reuse existing components where possible; restructure layout rather than rewrite logic.

---

## Current State Analysis

### Layout and page structure

**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Current structure:**
- **Grid (lg+):** `lg:grid-cols-[160px_minmax(0,1fr)_300px]` or collapsed `64px` for first column. Columns: (1) People sidebar, (2) Conversation area, (3) Orders panel.
- **Column 2** when not "All" tab: inner grid `lg:grid-cols-[220px_minmax(0,1fr)]` — conversation list (left) and ConversationView (right).
- **Column 2** when "All" tab and `selectedPersonId` set: shows `AllMessagesTimeline` only (unified timeline for that person).
- **State:** `activeTab` (all | email | sms | whatsapp), `searchQuery`, `selectedConversationId`, `selectedPersonId`, `selectedOrderId`, `selectedOrderForSidebar`, `isSidebarCollapsed`, etc.
- **Filters:** Mapped from `activeTab` and `selectedPersonId` into `ConversationFilters`: `status: 'open'`, optional `channel`, `search`, and either `person_id` or `unlinked_only: true` when no person selected.
- **Order sidebar:** Page-level `selectedOrderForSidebar`; backdrop + `OrderDetailsSidebar` at root; opened from PersonOrdersPanel via `onOpenOrderDetails(order)`.

**Observations:**
- Person context today is either (1) selected in People sidebar (`selectedPersonId`) or (2) from the selected conversation (`selectedConversation?.person_id`). `activePersonId = selectedConversation?.person_id ?? selectedPersonId`.
- Removing the People column implies person context comes only from the selected conversation (and linking flow). Filter "Unlinked" maps to existing `unlinked_only`; "Unread" to `unread_only`; "Urgent" may need a convention (e.g. priority or keyword) if not already in API.
- Conversation list is inline in UnifiedInboxPage (Cards with CardHeader); not a dedicated component. Each row shows primary_handle, subject/preview, timestamp, unread badge, channel badge, checkbox.

### Conversation list (current)

**Location:** Rendered inside `UnifiedInboxPage.tsx` (lines ~419–506).

**Current row content:**
- Checkbox (selection for archive/mark read).
- Channel icon.
- Primary line: `conversation.primary_handle`.
- Secondary line: `conversation.subject || conversation.last_message_preview`.
- Timestamp: `formatConversationTimestamp(conversation.last_message_at)`.
- Badges: unread count (blue), channel (outline).

**Data available per conversation:** `InboxConversation`: id, channel, primary_handle, subject, status, unread_count, last_message_at, last_message_preview, person_id, link_state, link_meta. No linked order number on the type; would need to come from orders by person_id (e.g. first order or a dedicated API) if we show "linked order" in the list.

**Observations:**
- Mockup shows "linked person name" as primary title — we have `primary_handle` and optionally person via `person_id` (could resolve to customer name). Order number in list would require joining to orders for that person or extending API.
- Urgent: no explicit "urgent" in current types; could be a tag, or a filter based on subject/content/convention.

### People column (current)

**File:** `src/modules/inbox/components/PeopleSidebar.tsx`

**Current structure:**
- Search input "Search people..."; list from `useCustomersList()`; "Unlinked" button; customer rows with avatar/initials and name. `selectedPersonId` and `onSelectPerson` drive filter (when a person is selected, filters use `person_id`; when none, `unlinked_only: true`).
- Collapsible; collapse state in UnifiedInboxPage.

**Observations:**
- Removing this column means we no longer have "select a person first" to filter conversations. Filter will be: All | Unread | Urgent | Unlinked, plus channel dropdown. Person for the right-hand order panel comes from the selected conversation's `person_id`.

### Conversation area (current)

**Files:** `ConversationView.tsx`, `ConversationHeader.tsx`, `ConversationThread.tsx`

**ConversationView:** Composes LinkConversationModal, ConversationHeader, ConversationThread. Uses `useConversation(conversationId)`, `useMessagesByConversation(conversationId)`, `useCustomer(conversation?.person_id)`. Passes to header: displayName (person or primary_handle), secondaryLine (channel · primary_handle), linkStateLabel, action (Link person / Change link).

**ConversationHeader:** Displays displayName, secondaryLine, linkStateLabel badge, optional action button. No order badge today.

**ConversationThread:** Message list + AI suggestion (useSuggestedReply) + reply composer with channel switcher. Reply sent via useSendReply. Styling: message bubbles, timestamps, channel borders.

**Observations:**
- Header can be extended to show "linked order" badge (order number) if we pass order from parent — e.g. first order for `conversation.person_id` or a selected order id. Data from existing orders APIs.
- AI suggestion: already above composer; restyle only, no yellow banner.
- Reply composer: keep channel switcher (Email / WhatsApp / SMS); restyle to match mockup.

### Order context (current)

**File:** `src/modules/inbox/components/PersonOrdersPanel.tsx`

**Current structure:**
- Orders list for `personId` (from `useOrdersByPersonId`); row per order (display id, total, type, due date); click calls `onSelectOrder(order.id)` and `onOpenOrderDetails(order)`.
- No inline order "detail" block; opening details uses page-level `OrderDetailsSidebar` popout with full order object.
- `activePersonId` comes from selected conversation or (today) selected person in People sidebar.

**Observations:**
- Mockup shows an "Order context" sidebar with one order’s details (e.g. customer, location, type, workflow gates, financial). We already have OrderDetailsSidebar with rich detail. Options: (1) Reuse a compact version of order summary in the right column and keep "View full" opening existing OrderDetailsSidebar, or (2) Embed a read-only summary in the right column using existing order fields. "Do NOT implement the Actions section" — so no View Full Order / Send Invoice etc. as buttons; we can keep "click order row → open OrderDetailsSidebar" as is.
- "Show most recent order by default" + "clickable list of other orders" matches current PersonOrdersPanel list; we may add a "selected" order detail summary panel above or beside the list, using existing Order type fields only.

### Data access and filters

**Hooks/API:** `useConversationsList(filters)`, `useConversation(id)`, `useMessagesByConversation(id)`, `useCustomer(personId)`, `useOrdersByPersonId(personId)`, `useSuggestedReply`, `useSendReply`. Filters: `ConversationFilters`: status, channel, unread_only, search, person_id, unlinked_only.

**Observations:**
- "Unread" filter: set `unread_only: true` (already in type).
- "Unlinked" filter: set `unlinked_only: true` and do not set person_id (already supported).
- "Urgent": not in current API; if we add a filter, backend may need a convention (e.g. subject contains "urgent", or a future flag). Spec says preserve functionality — we can add a client-side or API filter for "urgent" if product agrees; otherwise show badge only when we have a convention.
- Channel dropdown: same as current channel filter (All = no channel; Email/SMS/WhatsApp = channel). Keep badges on rows.

---

## Target Layout and Requirements

### Three-column structure (desktop-first)

1. **Left column:** Conversation list only (no People column). Width similar to mockup (e.g. ~280px or flexible).
2. **Center column:** Conversation header + conversation thread + AI reply suggestion + reply composer. Full remaining width.
3. **Right column:** Order context panel: default to most recent order for the linked person; list of other orders; clicking an order updates displayed details. Reuse existing order data; no new backend fields; no Actions section from mockup.

### Conversation list (left)

- **Row content:** Linked person/customer name as primary title; linked order number if available; last message preview; timestamp; channel badge (Email / SMS / WhatsApp); status badges (Unread, Urgent, Unlinked as applicable).
- **Filtering:** Replace current tabs with: **All** | **Unread** | **Urgent** | **Unlinked** (filter bar). Add **channel selector dropdown** (All / Email / SMS / WhatsApp). Keep search. Channel selector does not remove channel badges from rows.
- **Selection:** Click row selects conversation (existing behavior). Checkbox for multi-select (archive, mark read) can remain.

### Conversation area (center)

- **Header:** Linked person name; linked order badge (e.g. ORD-xxxx) if available; secondary handle (email or phone); link/change-link controls. Place person linking controls near the header (existing ConversationHeader + LinkConversationModal).
- **Thread:** Keep current message rendering logic; restyle to match mockup (bubbles, alignment, timestamps).
- **AI reply suggestion:** Keep feature; restyle to match new UI. Do **not** implement yellow AI suggestion banner. Keep suggestion above reply composer.
- **Reply composer:** Keep reply channel switcher (Email / WhatsApp / SMS); restyle to match mockup.

### Right column: Order context panel

- Show **most recent order** for the linked person by default (person = `activePersonId` from selected conversation).
- **List of other orders** for that person; selecting another order updates the displayed order details (reuse existing order data and components where possible).
- Display only fields that already exist in the app; no mocked sections; do **not** implement the "Actions" section from the mockup.
- Reuse data from existing order sidebar/order system (Order type, PersonOrdersPanel data, OrderDetailsSidebar when opening full detail).

### Functionality to preserve

- Conversation selection and message loading.
- Sending replies (all channels).
- AI reply suggestions (above composer, no yellow banner).
- Person linking / change link (LinkConversationModal, link state in header).
- Archive and mark unread (bulk actions).
- Order data loading for linked person; switching between orders for that person; opening full order details (existing popout) if desired.

---

## Implementation Approach

### Phase 1: Layout and structure

- Remove People column from `UnifiedInboxPage`: delete PeopleSidebar and its grid column; remove `selectedPersonId` from driving the main grid (person context = selected conversation’s `person_id` only for the right panel and any "linked person" display).
- Change grid to three columns: conversation list | conversation area | order context. Adjust grid classes and column widths to match mockup.
- Ensure `activePersonId` is derived only from `selectedConversation?.person_id` (no fallback to a selected "person" from a sidebar). Keep state for selected conversation, selected order for list highlight, and order for sidebar popout.

### Phase 2: Filters and conversation list

- Replace tab row with filter bar: All, Unread, Urgent, Unlinked. Map to `ConversationFilters`: All = no extra; Unread = `unread_only: true`; Unlinked = `unlinked_only: true` (and no person_id); Urgent = define convention (e.g. filter by keyword or future flag).
- Add channel selector dropdown (All / Email / SMS / WhatsApp); map to `channel` in filters.
- Extract or refactor conversation list into a dedicated component; redesign row layout to show: person name (resolve from person_id if present, else primary_handle), order number (if we can derive it), preview, timestamp, channel badge, Unread/Urgent/Unlinked badges. Keep search and multi-select if present.

### Phase 3: Conversation header and thread

- Extend ConversationHeader (or ConversationView) to accept optional linked order number / order id; show order badge when available. Resolve from active person’s orders (e.g. first or most recent).
- Restyle ConversationHeader and ConversationThread to match mockup (typography, spacing, bubbles). Keep ConversationThread logic; adjust styles only.
- Restyle AI suggestion block and reply composer (channel switcher + input + send) to match mockup.

### Phase 4: Order context panel

- Redesign right column to match "Order context" mockup: one primary order summary (most recent by default) + list of other orders for the person. Reuse `useOrdersByPersonId(activePersonId)` and existing Order type. Selecting an order from the list updates the displayed summary.
- Use only existing order fields for the summary (no new backend fields). Do not add Actions section (View Full Order, Send Invoice, etc.) as in mockup; keep "click to open OrderDetailsSidebar" if that exists.
- Ensure panel is visible when a conversation with a linked person is selected; show empty state when no person or no orders.

### Safety considerations

- No changes to Supabase tables, RLS, or API contracts unless a small filter (e.g. "urgent") is added and agreed.
- Preserve real-time and Gmail sync behavior; preserve reply sending and linking flows.
- Test: conversation list filtering, selection, message load, reply send, AI suggestion, link/unlink, archive, mark unread, order list and order detail popout.

---

## What NOT to Do

- Do not add new backend fields or mocked data for the order context panel.
- Do not implement the yellow AI suggestion banner from the mockup.
- Do not implement the "Actions" section (View Full Order, Send Invoice, Schedule Install, Create Proof) in the order context panel; keep existing behavior (e.g. open full OrderDetailsSidebar on row click if that is current).
- Do not remove or rewrite working data-fetching or business logic; only restructure layout and styling.
- Do not introduce a new global state store for this refactor unless necessary; keep state in UnifiedInboxPage or existing hooks.

---

## Open Questions / Considerations

- **Urgent filter:** No "urgent" in current conversation type or API. Options: (1) Client-side filter by subject/preview text, (2) Backend flag later, (3) Omit filter until defined. Document decision in implementation.
- **Order number in conversation list:** Requires either joining to orders by person_id in the list or an API that returns "primary order id" per conversation. If not available, show order badge only in the conversation header when a conversation is selected and we have orders for that person.
- **Order context "workflow gates" (Permit, Materials, Lettering, Payment):** Mockup shows labels like "Pending", "Ordered", "In Progress", "Deposit Paid". Map from existing Order fields (e.g. permit_status, stone_status, proof_status, payment-related) if possible; otherwise simplify to existing fields only.
- **Responsive:** Mockup is desktop-first; current layout already has responsive behavior. Define how three columns collapse on small screens (e.g. stack list above thread, order panel below or drawer).

---

## Deliverables for Next Phase

### Files to modify

| File | Purpose |
|------|--------|
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Remove People column; three-column grid; new filter bar and channel dropdown; wire conversation list and order panel to new layout; derive activePersonId from conversation only. |
| Conversation list (inline or new component) | New row design (person name, order #, preview, timestamp, channel + status badges). Possibly extract to e.g. `ConversationList.tsx`. |
| `src/modules/inbox/components/ConversationHeader.tsx` | Optional order badge; restyle to match mockup; keep link/change-link. |
| `src/modules/inbox/components/ConversationView.tsx` | Pass order info to header if needed; restyle container. |
| `src/modules/inbox/components/ConversationThread.tsx` | Restyle messages, AI suggestion, reply composer to match mockup. |
| `src/modules/inbox/components/PersonOrdersPanel.tsx` or new OrderContextPanel | Redesign as "Order context" sidebar: default most recent order summary + list of orders; reuse existing data; no Actions section. |

### Components to reuse (as-is or with restyle)

- `LinkConversationModal`, `useConversation`, `useMessagesByConversation`, `useSendReply`, `useSuggestedReply`, `useOrdersByPersonId`, `OrderDetailsSidebar` (popout), order types and display helpers.
- `ConversationHeader` (extend props for order badge; restyle).
- `ConversationThread` (restyle only; keep logic).
- PeopleSidebar: **remove** from page; component can remain in codebase if used elsewhere, or delete if unused.

### Components to restructure

- **Conversation list:** Currently inline in UnifiedInboxPage; extract to a component and implement new row layout and filter bar.
- **Order context (right column):** Replace or heavily restyle PersonOrdersPanel into an "Order context" panel with one main order summary + list of orders; selection updates summary; reuse existing order fetch and types.

### Minimal architecture changes

- **State:** Remove `selectedPersonId` from driving main inbox layout (person = conversation’s person_id). Optionally keep a minimal "unlinked" vs "filter by person" if Unlinked filter is the only person-based filter.
- **Filters:** Extend or remap filter state to support All / Unread / Urgent / Unlinked + channel dropdown; keep using existing `ConversationFilters` and `useConversationsList(filters)`.
- **Order in header:** If we show "linked order" in header, pass order id or order number from parent (UnifiedInboxPage or ConversationView) derived from `activePersonId` and orders list.

### UI constraints that may prevent exact match

- **Urgent:** No backend support yet; may be placeholder or client-side heuristic.
- **Order number in list:** Depends on ability to resolve "primary order" per conversation without N+1; may show only in header when conversation is selected.
- **Order context workflow labels:** Exact mockup wording (e.g. "Deposit Paid") must map to existing Order fields; some labels may be simplified.
- **Visual design system:** Match mockup colors, spacing, and typography within existing Tailwind/shadcn setup; some pixel-perfect details may require design tokens or overrides.
