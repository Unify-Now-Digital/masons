# Unified Inbox UI Redesign — Implementation Plan

Minimal plan based on the approved spec. Priorities: preserve functionality, remove People column, match mockup visually, reuse existing hooks/components/data. No new backend fields or fake business logic; use graceful fallbacks where mockup elements don’t map to real data.

---

## 1. activePersonId After Removing the People Column

**Current:** `activePersonId = selectedConversation?.person_id ?? selectedPersonId`

**After change:** `activePersonId = selectedConversation?.person_id ?? null`

- Remove all use of `selectedPersonId` in `UnifiedInboxPage`.
- Person context is **only** from the selected conversation’s `person_id`.
- Right-hand order panel, center header “linked person”, and any person-scoped UI use `activePersonId` from the selected conversation.
- When no conversation is selected, `activePersonId` is `null` (order panel shows “Select a conversation” or empty state).

**Files:** `UnifiedInboxPage.tsx` — delete `selectedPersonId` state, collapse/expand button for People sidebar, and `PeopleSidebar` usage; keep `activePersonId` derived only from `selectedConversation?.person_id`.

---

## 2. Unlinked Conversations

**Current:** When no person is selected in the People sidebar, filters use `unlinked_only: true`. When a person is selected, filters use `person_id`.

**After change:** No People column. Filters are driven only by the new filter bar:

- **“Unlinked” filter:** Set `unlinked_only: true` and do **not** set `person_id`. Same as today’s API: `inbox_conversations.person_id IS NULL`.
- **“All” filter:** Do not set `unlinked_only` or `person_id` — backend returns all open conversations (any person_id).
- **“Unread” filter:** Set `unread_only: true` (existing `ConversationFilters`).
- **“Urgent” filter:** See section 4.

So unlinked conversations are handled purely by the **Unlinked** filter; no separate “selected person” state.

**Files:** `UnifiedInboxPage.tsx` — replace tab-based filter logic with a single filter state (e.g. `listFilter: 'all' | 'unread' | 'urgent' | 'unlinked'`) and build `ConversationFilters` from that plus channel and search. Remove any logic that set `person_id` or `unlinked_only` based on `selectedPersonId`.

---

## 3. Conversation Rows: Person Name and Order Number (Existing Data Only)

**Person name (primary title):**

- Conversations have `person_id` and `primary_handle`; they do **not** have a resolved person name.
- **Approach:** In the conversation list container, call `useCustomersList()` once. Build a `Map<string, string>` from `customer.id` → display name (e.g. `[first_name, last_name].filter(Boolean).join(' ') || email || phone || '—'`). For each row, primary title = `personNameMap.get(conversation.person_id) ?? conversation.primary_handle`. So linked conversations show customer name when available; unlinked show handle. No new API; reuse existing `useCustomersList`.

**Order number in list:**

- There is no “order per conversation” in the API; orders are per person via `useOrdersByPersonId(person_id)`. Doing that per row would be N+1.
- **Fallback:** Do **not** show order number in the conversation list. Show order only in the **center header** when a conversation is selected (see section 6). List row stays: person name (or handle), preview, timestamp, channel badge, status badges.

**Summary:** List primary title = resolved person name when `person_id` is in customers list, else `primary_handle`. No order number in list.

**Files:** New or refactored conversation list component (or the section in `UnifiedInboxPage` that renders the list) — use `useCustomersList()`, build the map, pass to row render. Rows receive `conversation` and `personDisplayName: string`.

---

## 4. Filters: All / Unread / Urgent / Unlinked and Channel

**Filter bar (All | Unread | Urgent | Unlinked):**

- **All:** `ConversationFilters`: `{ status: 'open' }` (+ search/channel as below). No `unread_only`, no `unlinked_only`, no `person_id`.
- **Unread:** Same, plus `unread_only: true`. Backend already supports `unread_only` (e.g. `unread_count > 0`).
- **Unlinked:** Same as today: `unlinked_only: true`, no `person_id`. Backend: `person_id IS NULL`.
- **Urgent:** No field in DB or API. **Graceful fallback:** Do **not** add a backend filter. Treat “Urgent” as a **client-side filter**: fetch with the same base filters as “All” (status open + optional channel + search), then in the UI filter the result where `subject` or `last_message_preview` contains `"urgent"` (case-insensitive). If the filter is “Urgent” and no conversations match, show empty state. No fake backend; no new columns.

**Channel dropdown:**

- State: e.g. `channelFilter: 'all' | 'email' | 'sms' | 'whatsapp'`.
- Map to `ConversationFilters.channel`: only set when `channelFilter !== 'all'`. Same as current tab behavior; just driven by a dropdown instead of tabs.
- Channel badges on each row stay; they are per-conversation and independent of the dropdown.

**Implementation:** One filter state object, e.g. `{ listFilter: 'all' | 'unread' | 'urgent' | 'unlinked', channelFilter: 'all' | 'email' | 'sms' | 'whatsapp', searchQuery }`. Build `ConversationFilters` in `useMemo`: always `status: 'open'`; add `unread_only` when listFilter === 'unread'; add `unlinked_only` when listFilter === 'unlinked'; add `channel` when channelFilter !== 'all'; add `search` when searchQuery non-empty. When listFilter === 'urgent', do **not** add any extra API filter; after receiving conversations, filter with `c => /urgent/i.test(c.subject ?? '') || /urgent/i.test(c.last_message_preview ?? '')`.

**Files:** `UnifiedInboxPage.tsx` — new filter state; replace Tabs with filter bar + channel dropdown; single `useConversationsList(filters)`; optional client-side filter for Urgent applied to `conversations` before rendering the list.

---

## 5. Channel Dropdown Wiring

- Add state: `channelFilter: 'all' | 'email' | 'sms' | 'whatsapp'` (or reuse a single “channel” field that can be null for “all”).
- In the same `useMemo` that builds `ConversationFilters`, set `filters.channel = channelFilter` only when `channelFilter !== 'all'`.
- UI: Replace the four Tabs (All, Email, SMS, WhatsApp) with: (1) Filter bar for All / Unread / Urgent / Unlinked; (2) A separate **channel selector dropdown** (e.g. Select or DropdownMenu) with options “All”, “Email”, “SMS”, “WhatsApp”. List continues to show channel badge on each row.

**Files:** `UnifiedInboxPage.tsx` only (layout and filter state).

---

## 6. Center Header: Linked Person, Order Badge, Link Controls

**Existing:** `ConversationView` already has `useConversation`, `useCustomer(conversation.person_id)`, and passes display name, secondary line (channel · primary_handle), link state, and “Link person” / “Change link” to `ConversationHeader`. Link controls are in `ConversationHeader` + `LinkConversationModal`.

**Add:**

- **Order badge:** When the conversation has a linked person, show their “primary” or “most recent” order’s display id (e.g. ORD-xxxx) in the header.
- **How:** In `ConversationView`, call `useOrdersByPersonId(conversation?.person_id ?? '')` (or accept `orders` from parent to avoid duplicate fetch). If `orders.length > 0`, pass `orderDisplayId={getOrderDisplayId(orders[0])}` (or the order the user selected in the right panel, if we want to keep header in sync — for minimal scope, “most recent” = `orders[0]` is enough). `ConversationHeader` gets an optional `orderDisplayId?: string | null` and renders a small badge next to the name when present.
- Person name, secondary handle (email/phone), and link/change-link stay as today; only add the order badge and restyle to match mockup.

**Files:** `ConversationHeader.tsx` — add optional `orderDisplayId`, render badge. `ConversationView.tsx` — call `useOrdersByPersonId(conversation?.person_id ?? '')`, compute display id from `orders[0]`, pass to header. Reuse `getOrderDisplayId` from orders module.

---

## 7. Right Column: Order Context Panel — Default to Most Recent, Switch Among Orders

**Current:** `PersonOrdersPanel` already has `personId` (= `activePersonId`), `useOrdersByPersonId(personId)`, list of orders, `selectedOrderId`, `onSelectOrder`, and auto-selects first order when orders load. Clicking a row calls `onOpenOrderDetails(order)` to open the full `OrderDetailsSidebar` popout.

**Required:**

- **Default to most recent:** Keep existing behavior: orders from API are ordered by `created_at` desc, so `orders[0]` is most recent. Auto-select it (already done in `PersonOrdersPanel` via `onSelectOrder(orders[0].id)`).
- **Switch among orders:** Keep `selectedOrderId` and list; clicking another row calls `onSelectOrder(order.id)` and updates the **displayed** summary.
- **Display:** Add an **order summary block** at the top of the right column that shows the **selected** order’s key details (or most recent if none selected). Use only existing `Order` fields: e.g. order display id, customer name, location, order type, stone/permit/proof/payment-related status, outstanding amount if available. No “Actions” section (no View Full Order / Send Invoice buttons in the panel); keep “click row → open OrderDetailsSidebar” as the way to get full detail.
- **Empty state:** When `!activePersonId`, show “Select a conversation” or “No person linked”. When person has no orders, show “No orders for this person”.

**Implementation:** Restructure the right column into: (1) **Order summary card** — receives `order: Order | null` (selected order or `orders[0]`), renders a compact summary using existing fields; (2) **Orders list** — existing list; click sets `selectedOrderId` and the summary shows that order. Reuse `PersonOrdersPanel` or rename to something like `OrderContextPanel`; same props plus optional `selectedOrder` for the summary. Summary component can live in inbox (e.g. `OrderContextSummary.tsx`) and take an `Order`; no new backend.

**Files:** `PersonOrdersPanel.tsx` (or new `OrderContextPanel.tsx`) — add summary section above the list; summary shows `selectedOrder ?? orders[0]`. `UnifiedInboxPage.tsx` — ensure `activePersonId` and `selectedOrderId` / `selectedOrderForSidebar` are still passed correctly; right column always shows conversation’s person orders (or empty state).

---

## 8. Reuse vs Restructure

| Component / hook | Action |
|-----------------|--------|
| `useConversationsList`, `useConversation`, `useMessagesByConversation`, `useSendReply`, `useSuggestedReply` | **Reuse as-is.** |
| `useOrdersByPersonId`, `useCustomer`, `useCustomersList` | **Reuse as-is.** |
| `LinkConversationModal`, `ConversationThread` | **Reuse;** change only styling to match mockup. |
| `ConversationHeader` | **Extend:** add optional `orderDisplayId`, restyle. |
| `ConversationView` | **Extend:** call `useOrdersByPersonId` for header order badge; pass through. |
| `PeopleSidebar` | **Remove** from page; do not render. Can delete file or leave for later if used elsewhere. |
| Conversation list (currently inline in `UnifiedInboxPage`) | **Extract and restructure:** new component (e.g. `InboxConversationList.tsx`) with filter bar + channel dropdown + list; row shows person name (from customers map), preview, timestamp, channel badge, Unread/Urgent/Unlinked badges. |
| `PersonOrdersPanel` | **Restructure:** add order summary block at top; keep list below; same data and hooks. Optionally rename to `OrderContextPanel`. |
| `OrderDetailsSidebar` | **Reuse as-is** for “open full order” from list click. |
| `AllMessagesTimeline` | **Remove** from this flow. After removing People column there is no “selected person” to show a unified timeline; always show conversation list + center thread. If product wants unified timeline elsewhere, that’s a separate feature. |

---

## 9. Exact Files to Change

| File | Changes |
|------|--------|
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Remove People column and `selectedPersonId`; three-column grid (list \| center \| order panel); new filter state (listFilter, channelFilter, searchQuery) and filter bar + channel dropdown; build `ConversationFilters` from them; optional client-side Urgent filter; remove `showUnifiedTimeline` branch; always render conversation list + `ConversationView` in center; keep order panel and OrderDetailsSidebar popout. |
| `src/modules/inbox/components/ConversationHeader.tsx` | Add optional `orderDisplayId`; render order badge; restyle to match mockup. |
| `src/modules/inbox/components/ConversationView.tsx` | Call `useOrdersByPersonId(conversation?.person_id ?? '')`; pass `orderDisplayId={getOrderDisplayId(orders[0])}` when orders.length > 0; restyle wrapper if needed. |
| `src/modules/inbox/components/ConversationThread.tsx` | Restyle only (messages, AI suggestion, reply composer) to match mockup; no logic change. |
| New: `src/modules/inbox/components/InboxConversationList.tsx` (or keep inline) | Filter bar (All/Unread/Urgent/Unlinked), channel dropdown, search; use `useCustomersList()` and build person name map; render list rows with person name, preview, timestamp, channel + status badges; checkboxes for multi-select; emit `onSelectConversation`, selection state for archive/mark read. |
| `src/modules/inbox/components/PersonOrdersPanel.tsx` (or `OrderContextPanel.tsx`) | Add order summary block at top (selected order or orders[0]); reuse existing list and `onOpenOrderDetails`; optional restyle to match “Order context” mockup; no Actions section. |
| `src/modules/inbox/components/PeopleSidebar.tsx` | No code change; remove from `UnifiedInboxPage` imports and JSX. Delete file only if unused elsewhere. |

**Not changed:** `inboxConversations.api.ts`, `useInboxConversations.ts`, `inbox.types.ts` (unless we add a type for list filter for clarity). No new backend or API changes.

---

## 10. Implementation Order

1. **Layout and state (UnifiedInboxPage):** Remove People column; switch to three-column grid; drop `selectedPersonId`; derive `activePersonId` only from `selectedConversation?.person_id`; remove AllMessagesTimeline branch; always show list + ConversationView.
2. **Filters:** Add listFilter + channelFilter state; build `ConversationFilters`; add filter bar UI and channel dropdown; apply client-side Urgent filter when listFilter === 'urgent'.
3. **Conversation list:** Extract/refactor list; add `useCustomersList` and person-name map; implement new row layout (person name, preview, timestamp, badges); wire selection and multi-select.
4. **Center header:** ConversationView: fetch orders for person, pass order display id to header; ConversationHeader: add order badge and restyle.
5. **Order context panel:** Add summary block; keep list and selection; restyle; ensure default selected = most recent.
6. **Visual pass:** Restyle ConversationThread (messages, AI suggestion, composer), header, and list to match mockup.

---

## 11. Graceful Fallbacks Summary

- **Order number in list:** Omit (no N+1); show order only in center header when conversation selected.
- **Urgent:** Client-side filter on subject/preview only; no backend.
- **Person name in list:** Resolve via existing `useCustomersList()` + map; fallback to `primary_handle`.
- **Order context “workflow” labels:** Use only existing Order fields (e.g. stone_status, permit_status, proof_status, deposit/payment); if a label in the mockup has no field, omit or use the closest existing field.
- **Actions section in order panel:** Omit; keep “click order → open OrderDetailsSidebar” as the only “view full” path.
